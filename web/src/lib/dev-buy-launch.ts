import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type Address,
  type PublicClient,
  zeroAddress,
} from "viem";

import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import {
  DEFAULT_TOTAL_SUPPLY,
  getSwapRouterAddress,
  isProductionSwapRouter,
  STABLE_QUOTE_ADDRESS,
} from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { hookitSwapRouterAbi, poolSwapTestAbi } from "@/lib/contracts/swap-abi";
import {
  BASE_FEE_BPS,
  DEFAULT_LAUNCH_ETH_USD,
  GRADUATION_ETH,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import type { V4PoolKey } from "@/lib/pool-key";
import type { LaunchFormState } from "@/lib/types";
import { hookRecipientData, hookSwapDirection, sqrtLimit } from "@/lib/v4-bridge";

export const MAX_DEV_BUY_SUPPLY_PCT = 2.5;
const BPS = 10_000n;
const CURVE_SUPPLY_BPS = 8_000n;
const GRADUATION_ETH_WEI = parseEther(String(GRADUATION_ETH));
const VIRTUAL_QUOTE_START_ETH = parseEther("1");

export type DevBuyMode = "supply" | "eth";

function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / BPS;
}

/** Mirrors BondingMath.quoteInForTokensOut (ceil). */
function quoteInForTokensOut(
  virtualQuote: bigint,
  virtualToken: bigint,
  tokensOut: bigint,
): bigint {
  if (tokensOut <= 0n || virtualQuote <= 0n || virtualToken <= 0n || tokensOut >= virtualToken) {
    return 0n;
  }
  const newVirtualToken = virtualToken - tokensOut;
  const k = virtualQuote * virtualToken;
  const newVirtualQuote = (k + newVirtualToken - 1n) / newVirtualToken;
  if (newVirtualQuote <= virtualQuote) return 0n;
  return newVirtualQuote - virtualQuote;
}

function grossQuoteFromNet(net: bigint): bigint {
  const feeBps = BigInt(BASE_FEE_BPS);
  if (feeBps >= BPS) return net;
  return (net * BPS + (BPS - feeBps - 1n)) / (BPS - feeBps);
}

export function devBuyTokensForSupplyPct(supplyPct: number): bigint {
  const clamped = Math.min(MAX_DEV_BUY_SUPPLY_PCT, Math.max(0, supplyPct));
  if (clamped <= 0) return 0n;
  const bps = BigInt(Math.round(clamped * 100));
  return (DEFAULT_TOTAL_SUPPLY * bps) / 10_000n;
}

export function initialBondingVirtualState(graduationQuoteWei: bigint) {
  const curveSupply = (DEFAULT_TOTAL_SUPPLY * CURVE_SUPPLY_BPS) / BPS;
  let virtualQuote =
    graduationQuoteWei > 0n
      ? (graduationQuoteWei * VIRTUAL_QUOTE_START_ETH) / GRADUATION_ETH_WEI
      : 1n;
  if (virtualQuote <= 0n) virtualQuote = 1n;
  return { virtualQuote, virtualToken: curveSupply, curveSupply };
}

/** Estimate gross quote for a classic bonding dev buy (% of total supply). */
export function estimateClassicDevBuyQuoteWei(
  supplyPct: number,
  graduationQuoteWei: bigint,
): bigint {
  const tokensOut = devBuyTokensForSupplyPct(supplyPct);
  if (tokensOut <= 0n) return 0n;
  const { virtualQuote, virtualToken, curveSupply } = initialBondingVirtualState(graduationQuoteWei);
  const capped = tokensOut > curveSupply ? curveSupply : tokensOut;
  const net = quoteInForTokensOut(virtualQuote, virtualToken, capped);
  return grossQuoteFromNet(net);
}

/** Spot FDV estimate for master dev buy (% of total supply). */
export function estimateMasterDevBuyQuoteWei(supplyPct: number, mcapQuoteWei: bigint): bigint {
  const clamped = Math.min(MAX_DEV_BUY_SUPPLY_PCT, Math.max(0, supplyPct));
  if (clamped <= 0 || mcapQuoteWei <= 0n) return 0n;
  const bps = BigInt(Math.round(clamped * 100));
  return (mcapQuoteWei * bps) / 10_000n;
}

export function fallbackGraduationQuoteWei(quote: Address, ethUsd = DEFAULT_LAUNCH_ETH_USD): bigint {
  if (quote === zeroAddress) return parseEther(String(GRADUATION_ETH));
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) {
    return parseUnits(String(GRADUATION_ETH * ethUsd), 6);
  }
  return parseEther(String(GRADUATION_ETH));
}

export function fallbackMcapQuoteWei(quote: Address, ethUsd = DEFAULT_LAUNCH_ETH_USD): bigint {
  if (quote === zeroAddress) {
    return parseEther(String(TARGET_LAUNCH_MCAP_USD / ethUsd));
  }
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) {
    return parseUnits(String(TARGET_LAUNCH_MCAP_USD), 6);
  }
  return parseEther(String(TARGET_LAUNCH_MCAP_USD / ethUsd));
}

export function maxDevBuyEthHint(mcapQuoteWei: bigint): number {
  const eth = Number(formatEther(mcapQuoteWei * 250n / 10_000n));
  return eth > 0 ? eth : TARGET_LAUNCH_MCAP_USD * 0.025 / DEFAULT_LAUNCH_ETH_USD;
}

export function hasDevBuyConfigured(form: LaunchFormState): boolean {
  if (form.devBuyMode === "supply") {
    return form.devBuySupplyPct > 0;
  }
  const n = Number(form.devBuyEth);
  return !!form.devBuyEth && Number.isFinite(n) && n > 0;
}

export function resolveDevBuyQuoteWei(
  form: LaunchFormState,
  opts: {
    rail: "classic" | "master";
    quote: Address;
    graduationQuoteWei?: bigint;
    mcapQuoteWei?: bigint;
  },
): bigint | null {
  if (!hasDevBuyConfigured(form)) return null;

  const graduation =
    opts.graduationQuoteWei ?? fallbackGraduationQuoteWei(opts.quote);
  const mcap = opts.mcapQuoteWei ?? fallbackMcapQuoteWei(opts.quote);

  if (form.devBuyMode === "supply") {
    const pct = Math.min(MAX_DEV_BUY_SUPPLY_PCT, Math.max(0, form.devBuySupplyPct));
    if (pct <= 0) return null;
    return opts.rail === "classic"
      ? estimateClassicDevBuyQuoteWei(pct, graduation)
      : estimateMasterDevBuyQuoteWei(pct, mcap);
  }

  const quoteDecimals =
    opts.quote === zeroAddress ? 18 : opts.quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase() ? 6 : 18;
  let amount: bigint;
  try {
    amount =
      quoteDecimals === 18
        ? parseEther(form.devBuyEth)
        : parseUnits(form.devBuyEth, quoteDecimals);
  } catch {
    return null;
  }
  if (amount <= 0n) return null;

  const maxWei =
    opts.rail === "classic"
      ? estimateClassicDevBuyQuoteWei(MAX_DEV_BUY_SUPPLY_PCT, graduation)
      : estimateMasterDevBuyQuoteWei(MAX_DEV_BUY_SUPPLY_PCT, mcap);
  if (maxWei > 0n && amount > maxWei) amount = maxWei;
  return amount;
}

async function readClassicGraduationQuote(
  client: PublicClient,
  factory: Address,
  quote: Address,
): Promise<bigint> {
  try {
    return (await client.readContract({
      address: factory,
      abi: bondingFactoryAbi,
      functionName: "graduationQuoteWei",
      args: [quote],
    })) as bigint;
  } catch {
    return fallbackGraduationQuoteWei(quote);
  }
}

async function readMasterMcapQuote(
  client: PublicClient,
  factory: Address,
  quote: Address,
): Promise<bigint> {
  try {
    return (await client.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "mcapQuoteFor",
      args: [quote],
    })) as bigint;
  } catch {
    return fallbackMcapQuoteWei(quote);
  }
}

async function buildMasterPoolKey(
  client: PublicClient,
  factory: Address,
  launchId: bigint,
): Promise<V4PoolKey> {
  const key = (await client.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "poolKeyOf",
    args: [launchId],
  })) as V4PoolKey;
  return key;
}

export async function executeDevBuyAfterLaunch(opts: {
  client: PublicClient;
  writeContractAsync: (args: Record<string, unknown>) => Promise<`0x${string}`>;
  rail: "classic" | "master";
  form: LaunchFormState;
  launchId: bigint;
  token: Address;
  factory: Address;
  creator: Address;
  quote: Address;
}): Promise<`0x${string}` | null> {
  const graduation =
    opts.rail === "classic"
      ? await readClassicGraduationQuote(opts.client, opts.factory, opts.quote)
      : undefined;
  const mcap =
    opts.rail === "master"
      ? await readMasterMcapQuote(opts.client, opts.factory, opts.quote)
      : undefined;

  const quoteWei = resolveDevBuyQuoteWei(opts.form, {
    rail: opts.rail,
    quote: opts.quote,
    graduationQuoteWei: graduation,
    mcapQuoteWei: mcap,
  });
  if (!quoteWei || quoteWei <= 0n) return null;

  if (opts.rail === "classic") {
    const isEth = opts.quote === zeroAddress;
    if (!isEth) {
      const allowance = (await opts.client.readContract({
        address: opts.quote,
        abi: erc20Abi,
        functionName: "allowance",
        args: [opts.creator, opts.factory],
      })) as bigint;
      if (allowance < quoteWei) {
        const approveHash = await opts.writeContractAsync({
          address: opts.quote,
          abi: erc20Abi,
          functionName: "approve",
          args: [opts.factory, quoteWei],
        });
        await opts.client.waitForTransactionReceipt({ hash: approveHash });
      }
    }

    const hash = await opts.writeContractAsync({
      address: opts.factory,
      abi: bondingFactoryAbi,
      functionName: "buy",
      args: [opts.launchId, quoteWei, 1n],
      value: isEth ? quoteWei : 0n,
    });
    await opts.client.waitForTransactionReceipt({ hash });
    return hash;
  }

  const poolKey = await buildMasterPoolKey(opts.client, opts.factory, opts.launchId);
  const zeroForOne = hookSwapDirection(poolKey, opts.token, "buy");
  const limit = sqrtLimit(zeroForOne);
  const hookData = hookRecipientData(opts.creator);
  const isEth = opts.quote === zeroAddress;

  let router: Address;
  try {
    router = getSwapRouterAddress();
  } catch {
    return null;
  }

  if (!isEth) {
    const allowance = (await opts.client.readContract({
      address: opts.quote,
      abi: erc20Abi,
      functionName: "allowance",
      args: [opts.creator, router],
    })) as bigint;
    if (allowance < quoteWei) {
      const approveHash = await opts.writeContractAsync({
        address: opts.quote,
        abi: erc20Abi,
        functionName: "approve",
        args: [router, quoteWei],
      });
      await opts.client.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  let hash: `0x${string}`;
  if (isProductionSwapRouter()) {
    hash = await opts.writeContractAsync({
      address: router,
      abi: hookitSwapRouterAbi,
      functionName: "swapExactIn",
      args: [poolKey, zeroForOne, quoteWei, 1n, limit],
      value: quoteWei,
    });
  } else {
    hash = await opts.writeContractAsync({
      address: router,
      abi: poolSwapTestAbi,
      functionName: "swap",
      args: [
        poolKey,
        {
          zeroForOne,
          amountSpecified: -quoteWei,
          sqrtPriceLimitX96: limit,
        },
        { takeClaims: false, settleUsingBurn: false },
        hookData,
      ],
      value: quoteWei,
    });
  }

  await opts.client.waitForTransactionReceipt({ hash });
  return hash;
}

export function devBuyPayLabel(quote: Address): string {
  if (quote === zeroAddress) return "ETH";
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return "USDG";
  return "quote";
}

export function formatDevBuyQuoteHint(amountWei: bigint, quote: Address): string {
  if (quote === zeroAddress) return `~${formatEther(amountWei)} ETH`;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) {
    return `~${formatUnits(amountWei, 6)} USDG`;
  }
  return `~${formatEther(amountWei)}`;
}

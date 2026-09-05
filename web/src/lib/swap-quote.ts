import { formatUnits, parseUnits, type Address, type PublicClient, zeroAddress } from "viem";

import {
  isDirectBuy,
  paymentAssetById,
  poolQuoteAddress,
  poolQuoteLabel,
  type PaymentAssetId,
} from "@/lib/payment-assets";
import { poolKeyForQuote, poolKeyFromLaunch } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";
import { needsCompositeSell, type SwapAsset } from "@/lib/swap-assets";
import {
  findBridgeAmountOut,
  hookRecipientData,
  hookSwapDirection,
} from "@/lib/v4-bridge";
import { V4_QUOTER_ADDRESS } from "@/lib/contracts/config";
import { v4QuoterAbi } from "@/lib/contracts/swap-abi";

export type SwapSide = "buy" | "sell";

/** Shared quote fields shown in swap UI (pool + bonding). */
export type SwapQuoteDisplayMeta = {
  amountOut: bigint;
  minAmountOut: bigint;
  priceImpactPct: number | null;
  route: string;
  /** True when on-chain quoter failed and spot price was used. */
  estimated?: boolean;
};

export type PoolSwapQuoteMeta = SwapQuoteDisplayMeta & {
  estimated: boolean;
};

export async function quoteHookLeg(
  client: PublicClient,
  pool: TokenPool,
  side: SwapSide,
  quoteAmountIn: bigint,
  recipient: Address = zeroAddress,
  marketQuote?: Address,
): Promise<bigint | null> {
  if (quoteAmountIn <= BigInt(0)) return null;
  const key = marketQuote
    ? poolKeyForQuote(pool, marketQuote) ?? poolKeyFromLaunch(pool, marketQuote)
    : poolKeyFromLaunch(pool);
  const token = pool.contractAddress as Address | undefined;
  if (!key || !token) return null;

  const zeroForOne = hookSwapDirection(key, token, side);
  const hookData = hookRecipientData(recipient);

  try {
    const { result } = await client.simulateContract({
      address: V4_QUOTER_ADDRESS,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: key,
          zeroForOne,
          exactAmount: quoteAmountIn,
          hookData,
        },
      ],
    });
    const amountOut = result[0] as bigint;
    return amountOut > BigInt(0) ? amountOut : null;
  } catch {
    return null;
  }
}

function spotQuoteFallback(
  pool: TokenPool,
  side: SwapSide,
  amountIn: bigint,
  decimalsIn: number,
  decimalsOut: number,
): bigint | null {
  if (!pool.priceEth || pool.priceEth <= 0) return null;
  const amountHuman = Number(formatUnits(amountIn, decimalsIn));
  if (!(amountHuman > 0)) return null;

  if (side === "buy") {
    const tokens = amountHuman / pool.priceEth;
    if (!(tokens > 0)) return null;
    try {
      return parseUnits(tokens.toFixed(Math.min(12, decimalsOut)), decimalsOut);
    } catch {
      return null;
    }
  }

  const quoteOut = amountHuman * pool.priceEth;
  if (!(quoteOut > 0)) return null;
  try {
    return parseUnits(quoteOut.toFixed(Math.min(12, decimalsOut)), decimalsOut);
  } catch {
    return null;
  }
}

function applySlippage(amount: bigint, slippagePct: number): bigint {
  const bps = Math.min(5_000, Math.max(0, Math.round(slippagePct * 100)));
  return (amount * BigInt(10_000 - bps)) / BigInt(10_000);
}

function priceImpactFromSpot(
  pool: TokenPool,
  side: SwapSide,
  amountInHuman: number,
  amountOutHuman: number,
): number | null {
  if (!pool.priceEth || pool.priceEth <= 0 || amountInHuman <= 0 || amountOutHuman <= 0) {
    return null;
  }
  if (side === "buy") {
    const spotOut = amountInHuman / pool.priceEth;
    if (spotOut <= 0) return null;
    return Math.max(0, ((spotOut - amountOutHuman) / spotOut) * 100);
  }
  const spotOut = amountInHuman * pool.priceEth;
  if (spotOut <= 0) return null;
  return Math.max(0, ((spotOut - amountOutHuman) / spotOut) * 100);
}

export async function quotePoolSwapWithMeta(
  client: PublicClient,
  pool: TokenPool,
  side: SwapSide,
  amountIn: bigint,
  slippagePct: number,
  paymentId: PaymentAssetId = "ETH",
  receiveAsset?: SwapAsset,
  recipient: Address = zeroAddress,
): Promise<PoolSwapQuoteMeta | null> {
  if (amountIn <= BigInt(0)) return null;

  let amountOut: bigint | null = null;
  let route = "—";
  let estimated = false;

  if (side === "sell") {
    route = `${pool.ticker} → ${poolQuoteLabel(pool)}`;
    amountOut = await quoteHookLeg(client, pool, "sell", amountIn, recipient);
    if (
      amountOut != null &&
      receiveAsset &&
      needsCompositeSell(pool, receiveAsset)
    ) {
      const poolQuote = poolQuoteAddress(pool);
      const receiveCurrency = receiveAsset.isNative
        ? zeroAddress
        : (receiveAsset.address ?? zeroAddress);
      const bridge = await findBridgeAmountOut(client, poolQuote, receiveCurrency, amountOut);
      if (!bridge) return null;
      amountOut = bridge.amountOut;
      route = `${pool.ticker} → ${poolQuoteLabel(pool)} → ${receiveAsset.symbol}`;
    }
  } else {
    const payment = paymentAssetById(paymentId);
    const poolQuote = poolQuoteAddress(pool);

    if (isDirectBuy(pool, payment)) {
      route = `${payment.label} → ${pool.ticker}`;
      // Multi-market: quote against the matching USDG/ETH/stock pool, not always market-0.
      amountOut = await quoteHookLeg(client, pool, "buy", amountIn, recipient, payment.address);
    } else {
      const bridge = await findBridgeAmountOut(client, payment.address, poolQuote, amountIn);
      if (!bridge) {
        amountOut = spotQuoteFallback(pool, side, amountIn, payment.decimals, 18);
        if (!amountOut) return null;
        route = `${payment.label} → ${pool.ticker} (est.)`;
        estimated = true;
      } else {
        route =
          bridge.routeLabel ??
          `${payment.label} → ${poolQuoteLabel(pool)} → ${pool.ticker}`;
        amountOut = await quoteHookLeg(client, pool, "buy", bridge.amountOut, recipient);
        if (!amountOut) {
          amountOut = spotQuoteFallback(pool, side, amountIn, payment.decimals, 18);
          if (!amountOut) return null;
          route = `${payment.label} → ${pool.ticker} (est.)`;
          estimated = true;
        }
      }
    }
  }

  if (!amountOut || amountOut <= BigInt(0)) {
    const decimalsIn = side === "buy" ? paymentAssetById(paymentId).decimals : 18;
    const decimalsOut = side === "buy" ? 18 : paymentAssetById(paymentId).decimals;
    amountOut = spotQuoteFallback(pool, side, amountIn, decimalsIn, decimalsOut);
    if (!amountOut) return null;
    estimated = true;
    route = side === "buy" ? `Spot est. · ${pool.ticker}` : `Spot est. · ${poolQuoteLabel(pool)}`;
  }

  const decimalsIn =
    side === "buy" ? paymentAssetById(paymentId).decimals : 18;
  const decimalsOut =
    side === "buy"
      ? 18
      : receiveAsset?.decimals ?? paymentAssetById(paymentId).decimals;

  const amountInHuman = Number(formatUnits(amountIn, decimalsIn));
  const amountOutHuman = Number(formatUnits(amountOut, decimalsOut));
  const impact = priceImpactFromSpot(pool, side, amountInHuman, amountOutHuman);

  return {
    amountOut,
    minAmountOut: applySlippage(amountOut, slippagePct),
    priceImpactPct: impact,
    route,
    estimated,
  };
}

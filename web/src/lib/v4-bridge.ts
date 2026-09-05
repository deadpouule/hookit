import { encodeAbiParameters, type Address, type Hex, type PublicClient, zeroAddress } from "viem";

import {
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  STABLE_QUOTE_ADDRESS,
  V4_QUOTER_ADDRESS,
} from "@/lib/contracts/config";
import { v4QuoterAbi } from "@/lib/contracts/swap-abi";
import { sortV4Currencies, type PaymentAsset } from "@/lib/payment-assets";
import type { V4PoolKey } from "@/lib/pool-key";
import {
  INK_QUOTRON_STOCKS,
  QUOTRONS_DYNAMIC_FEE,
  QUOTRONS_HOOK,
} from "@/lib/xstocks";

const ZERO_HOOKS = "0x0000000000000000000000000000000000000000" as Address;

const BRIDGE_CANDIDATES: { fee: number; tickSpacing: number }[] = [
  { fee: 0, tickSpacing: 60 },
  { fee: 0x80_0000, tickSpacing: 60 }, // Hookit / Quotrons dynamic fee pools
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 500, tickSpacing: 50 },
];

export type BridgeRoute = {
  key: V4PoolKey;
  zeroForOne: boolean;
  amountOut: bigint;
};

export type BridgeAmountOut = {
  amountOut: bigint;
  routeLabel?: string;
};

function quotronKeyForStock(stock: Address, usdg: Address): V4PoolKey | null {
  const listing = INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === stock.toLowerCase());
  if (!listing) return null;
  const [currency0, currency1] = sortV4Currencies(stock, usdg);
  return {
    currency0,
    currency1,
    fee: QUOTRONS_DYNAMIC_FEE,
    tickSpacing: 60,
    hooks: QUOTRONS_HOOK,
  };
}

async function quoteBridge(
  client: PublicClient,
  key: V4PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
): Promise<bigint | null> {
  try {
    const { result } = await client.simulateContract({
      address: V4_QUOTER_ADDRESS,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: key,
          zeroForOne,
          exactAmount: amountIn,
          hookData: "0x" as Hex,
        },
      ],
    });
    const amountOut = result[0] as bigint;
    return amountOut > BigInt(0) ? amountOut : null;
  } catch {
    return null;
  }
}

function bridgeRouteLabel(currencyIn: Address, currencyOut: Address): string {
  const inLabel =
    currencyIn === zeroAddress ? "ETH" : `${currencyIn.slice(0, 6)}…${currencyIn.slice(-4)}`;
  const outLabel =
    currencyOut === zeroAddress ? "ETH" : `${currencyOut.slice(0, 6)}…${currencyOut.slice(-4)}`;
  return `${inLabel} → ${outLabel}`;
}

export async function findBridgeRoute(
  client: PublicClient,
  currencyIn: Address,
  currencyOut: Address,
  amountIn: bigint,
): Promise<BridgeRoute | null> {
  if (amountIn <= BigInt(0)) return null;
  if (currencyIn.toLowerCase() === currencyOut.toLowerCase()) {
    return {
      key: {
        currency0: sortV4Currencies(currencyIn, currencyOut)[0],
        currency1: sortV4Currencies(currencyIn, currencyOut)[1],
        fee: 0,
        tickSpacing: 60,
        hooks: ZERO_HOOKS,
      },
      zeroForOne: false,
      amountOut: amountIn,
    };
  }

  const usdg = STABLE_QUOTE_ADDRESS;
  const inIsUsdg = currencyIn.toLowerCase() === usdg.toLowerCase();
  const outIsUsdg = currencyOut.toLowerCase() === usdg.toLowerCase();
  const stock = inIsUsdg ? currencyOut : outIsUsdg ? currencyIn : null;

  // Prefer Quotrons wStock/USDG markets when either leg is USDG and the other is a wrapped equity.
  if (stock) {
    const key = quotronKeyForStock(stock, usdg);
    if (key) {
      const zeroForOne = currencyIn.toLowerCase() === key.currency0.toLowerCase();
      const amountOut = await quoteBridge(client, key, zeroForOne, amountIn);
      if (amountOut != null) {
        return { key, zeroForOne, amountOut };
      }
    }
  }

  const [currency0, currency1] = sortV4Currencies(currencyIn, currencyOut);
  const zeroForOne = currencyIn.toLowerCase() === currency0.toLowerCase();

  let best: BridgeRoute | null = null;
  for (const { fee, tickSpacing } of BRIDGE_CANDIDATES) {
    const key: V4PoolKey = { currency0, currency1, fee, tickSpacing, hooks: ZERO_HOOKS };
    const amountOut = await quoteBridge(client, key, zeroForOne, amountIn);
    if (amountOut != null && (!best || amountOut > best.amountOut)) {
      best = { key, zeroForOne, amountOut };
    }
  }
  return best;
}

/** Quote bridge output, including a 2-hop fallback via USDG when direct route fails. */
export async function findBridgeAmountOut(
  client: PublicClient,
  currencyIn: Address,
  currencyOut: Address,
  amountIn: bigint,
): Promise<BridgeAmountOut | null> {
  if (amountIn <= BigInt(0)) return null;

  const direct = await findBridgeRoute(client, currencyIn, currencyOut, amountIn);
  if (direct) {
    return {
      amountOut: direct.amountOut,
      routeLabel: bridgeRouteLabel(currencyIn, currencyOut),
    };
  }

  const usdg = STABLE_QUOTE_ADDRESS;
  const inLower = currencyIn.toLowerCase();
  const outLower = currencyOut.toLowerCase();
  if (inLower === usdg.toLowerCase() || outLower === usdg.toLowerCase()) {
    return null;
  }

  const hop1 = await findBridgeRoute(client, currencyIn, usdg, amountIn);
  if (!hop1) return null;
  const hop2 = await findBridgeRoute(client, usdg, currencyOut, hop1.amountOut);
  if (!hop2) return null;

  return {
    amountOut: hop2.amountOut,
    routeLabel: `${bridgeRouteLabel(currencyIn, usdg)} → ${bridgeRouteLabel(usdg, currencyOut)}`,
  };
}

export function hookSwapDirection(poolKey: V4PoolKey, token: Address, side: "buy" | "sell"): boolean {
  const tokenIs0 = token.toLowerCase() === poolKey.currency0.toLowerCase();
  return side === "buy" ? !tokenIs0 : tokenIs0;
}

export function hookRecipientData(recipient: Address): Hex {
  return encodeAbiParameters([{ type: "address" }], [recipient]);
}

export function sqrtLimit(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE + BigInt(1) : MAX_SQRT_PRICE - BigInt(1);
}

export function paymentMatchesPoolQuote(payment: PaymentAsset, poolQuote: Address): boolean {
  return payment.address.toLowerCase() === poolQuote.toLowerCase();
}

export function isNative(currency: Address): boolean {
  return currency === zeroAddress;
}

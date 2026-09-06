import { type Address, type Hex, type PublicClient, zeroAddress } from "viem";

import { STABLE_QUOTE_ADDRESS, V4_QUOTER_ADDRESS } from "@/lib/contracts/config";
import { v4QuoterAbi } from "@/lib/contracts/swap-abi";
import { poolQuoteLabel, type PaymentAsset } from "@/lib/payment-assets";
import { isMultiPool, poolMarkets } from "@/lib/pool-active-market";
import { poolKeyForQuote, poolKeyFromLaunch, type V4PoolKey } from "@/lib/pool-key";
import type { SwapAsset } from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import {
  findBridgeRoute,
  hookRecipientData,
  hookSwapDirection,
  type BridgeRoute,
} from "@/lib/v4-bridge";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

export type BestSellRoute =
  | {
      kind: "direct";
      marketQuote: Address;
      hookKey: V4PoolKey;
      amountOut: bigint;
      routeLabel: string;
    }
  | {
      kind: "composite";
      marketQuote: Address;
      hookKey: V4PoolKey;
      bridge: BridgeRoute;
      amountOut: bigint;
      intermediateOut: bigint;
      routeLabel: string;
    };

export type BestBuyLeg =
  | {
      kind: "direct";
      marketQuote: Address;
      hookKey: V4PoolKey;
      amountIn: bigint;
      amountOut: bigint;
      routeLabel: string;
    }
  | {
      kind: "composite";
      marketQuote: Address;
      hookKey: V4PoolKey;
      bridge: BridgeRoute;
      amountIn: bigint;
      amountOut: bigint;
      routeLabel: string;
    };

export type BestBuyPlan = {
  legs: BestBuyLeg[];
  amountOut: bigint;
  routeLabel: string;
};

const SPLIT_BPS = [3_000, 4_000, 5_000, 6_000, 7_000] as const;

function receiveCurrency(receive: SwapAsset): Address {
  if (receive.isNative) return zeroAddress;
  return (receive.address ?? zeroAddress) as Address;
}

function quoteLabel(pool: TokenPool, quote: Address): string {
  if (quote === zeroAddress) return "ETH";
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) {
    return poolQuoteLabel({ ...pool, quoteAddress: quote, quoteAsset: "USDG" });
  }
  const stock = INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === quote.toLowerCase());
  return stock?.symbol ?? poolQuoteLabel({ ...pool, quoteAddress: quote });
}

function isStockQuote(quote: Address): boolean {
  return INK_QUOTRON_STOCKS.some((s) => s.address.toLowerCase() === quote.toLowerCase());
}

async function quoteExactInOnKey(
  client: PublicClient,
  hookKey: V4PoolKey,
  token: Address,
  side: "buy" | "sell",
  amountIn: bigint,
  recipient: Address,
): Promise<bigint | null> {
  const zeroForOne = hookSwapDirection(hookKey, token, side);
  const hookData = hookRecipientData(recipient);
  try {
    const { result } = await client.simulateContract({
      address: V4_QUOTER_ADDRESS,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: hookKey,
          zeroForOne,
          exactAmount: amountIn,
          hookData: hookData as Hex,
        },
      ],
    });
    const amountOut = result[0] as bigint;
    return amountOut > BigInt(0) ? amountOut : null;
  } catch {
    return null;
  }
}

async function quoteSellOnMarket(
  client: PublicClient,
  pool: TokenPool,
  amountIn: bigint,
  marketQuote: Address,
  recipient: Address,
): Promise<{ hookKey: V4PoolKey; amountOut: bigint } | null> {
  const hookKey = poolKeyForQuote(pool, marketQuote) ?? poolKeyFromLaunch(pool, marketQuote);
  const token = pool.contractAddress as Address | undefined;
  if (!hookKey || !token || amountIn <= BigInt(0)) return null;
  const amountOut = await quoteExactInOnKey(client, hookKey, token, "sell", amountIn, recipient);
  if (!amountOut) return null;
  return { hookKey, amountOut };
}

async function quoteBuyLeg(
  client: PublicClient,
  pool: TokenPool,
  payment: PaymentAsset,
  amountIn: bigint,
  marketQuote: Address,
  recipient: Address,
): Promise<BestBuyLeg | null> {
  const hookKey = poolKeyForQuote(pool, marketQuote) ?? poolKeyFromLaunch(pool, marketQuote);
  const token = pool.contractAddress as Address | undefined;
  if (!hookKey || !token || amountIn <= BigInt(0)) return null;

  const pay = payment.address;
  const midLabel = quoteLabel(pool, marketQuote);

  // Soft-launch: no ETH → stock bridge (Quotrons path is USDG-based).
  if (pay === zeroAddress && isStockQuote(marketQuote)) return null;

  if (pay.toLowerCase() === marketQuote.toLowerCase()) {
    const amountOut = await quoteExactInOnKey(client, hookKey, token, "buy", amountIn, recipient);
    if (!amountOut) return null;
    return {
      kind: "direct",
      marketQuote,
      hookKey,
      amountIn,
      amountOut,
      routeLabel: `${payment.label} → ${pool.ticker}`,
    };
  }

  const bridge = await findBridgeRoute(client, pay, marketQuote, amountIn);
  if (!bridge || bridge.amountOut <= BigInt(0)) return null;
  const amountOut = await quoteExactInOnKey(
    client,
    hookKey,
    token,
    "buy",
    bridge.amountOut,
    recipient,
  );
  if (!amountOut) return null;
  return {
    kind: "composite",
    marketQuote,
    hookKey,
    bridge,
    amountIn,
    amountOut,
    routeLabel: `${payment.label} → ${midLabel} → ${pool.ticker}`,
  };
}

/** Unique quote addresses for every Hookit market on this launch. */
export function multiPoolMarketQuotes(pool: TokenPool): Address[] {
  const markets = poolMarkets(pool);
  const out: Address[] = [];
  const seen = new Set<string>();
  for (const m of markets) {
    const q = (m.quoteAddress ?? zeroAddress) as Address;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  if (out.length === 0) out.push((pool.quoteAddress ?? zeroAddress) as Address);
  return out;
}

/**
 * Quote every Hookit market leg (and optional 1-hop bridge to the receive asset),
 * then pick the max `amountOut`. Lightweight aggregator for multi-pool sells.
 */
export async function quoteBestSellRoute(
  client: PublicClient,
  pool: TokenPool,
  amountIn: bigint,
  receive: SwapAsset,
  recipient: Address = zeroAddress,
): Promise<BestSellRoute | null> {
  if (amountIn <= BigInt(0)) return null;

  const want = receiveCurrency(receive);
  const marketQuotes = multiPoolMarketQuotes(pool);
  const candidates: BestSellRoute[] = [];

  await Promise.all(
    marketQuotes.map(async (marketQuote) => {
      const quoted = await quoteSellOnMarket(client, pool, amountIn, marketQuote, recipient);
      if (!quoted) return;

      const midLabel = quoteLabel(pool, marketQuote);

      if (marketQuote.toLowerCase() === want.toLowerCase()) {
        candidates.push({
          kind: "direct",
          marketQuote,
          hookKey: quoted.hookKey,
          amountOut: quoted.amountOut,
          routeLabel: `${pool.ticker} → ${receive.symbol}`,
        });
        return;
      }

      const bridge = await findBridgeRoute(client, marketQuote, want, quoted.amountOut);
      if (!bridge || bridge.amountOut <= BigInt(0)) return;

      candidates.push({
        kind: "composite",
        marketQuote,
        hookKey: quoted.hookKey,
        bridge,
        amountOut: bridge.amountOut,
        intermediateOut: quoted.amountOut,
        routeLabel: `${pool.ticker} → ${midLabel} → ${receive.symbol}`,
      });
    }),
  );

  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) => (cur.amountOut > best.amountOut ? cur : best));
}

/**
 * Best buy plan: try each market at 100%, then optionally split size across the top two
 * routes when a split yields more tokens than any single pool.
 */
export async function quoteBestBuyPlan(
  client: PublicClient,
  pool: TokenPool,
  payment: PaymentAsset,
  amountIn: bigint,
  recipient: Address = zeroAddress,
): Promise<BestBuyPlan | null> {
  if (amountIn <= BigInt(0)) return null;

  const marketQuotes = multiPoolMarketQuotes(pool);
  const singles: BestBuyLeg[] = [];

  await Promise.all(
    marketQuotes.map(async (marketQuote) => {
      const leg = await quoteBuyLeg(client, pool, payment, amountIn, marketQuote, recipient);
      if (leg) singles.push(leg);
    }),
  );

  if (singles.length === 0) return null;

  singles.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1));
  const bestSingle = singles[0]!;
  let bestPlan: BestBuyPlan = {
    legs: [bestSingle],
    amountOut: bestSingle.amountOut,
    routeLabel: bestSingle.routeLabel,
  };

  if (singles.length < 2) return bestPlan;

  const a = singles[0]!;
  const b = singles[1]!;

  for (const bps of SPLIT_BPS) {
    const amountA = (amountIn * BigInt(bps)) / 10_000n;
    const amountB = amountIn - amountA;
    if (amountA <= 0n || amountB <= 0n) continue;

    const [legA, legB] = await Promise.all([
      quoteBuyLeg(client, pool, payment, amountA, a.marketQuote, recipient),
      quoteBuyLeg(client, pool, payment, amountB, b.marketQuote, recipient),
    ]);
    if (!legA || !legB) continue;

    const total = legA.amountOut + legB.amountOut;
    if (total > bestPlan.amountOut) {
      const pctA = Math.round(bps / 100);
      bestPlan = {
        legs: [legA, legB],
        amountOut: total,
        routeLabel: `Split ${pctA}/${100 - pctA}% · ${legA.routeLabel} + ${legB.routeLabel}`,
      };
    }
  }

  return bestPlan;
}

export function shouldAggregateMultiSell(pool: TokenPool, receive?: SwapAsset): boolean {
  return !!receive && isMultiPool(pool) && multiPoolMarketQuotes(pool).length > 1;
}

export function shouldAggregateMultiBuy(pool: TokenPool): boolean {
  return isMultiPool(pool) && multiPoolMarketQuotes(pool).length > 1;
}

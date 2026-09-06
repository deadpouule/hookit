import { type Address, type Hex, type PublicClient, zeroAddress } from "viem";

import { getLaunchFactoryAddress, STABLE_QUOTE_ADDRESS, V4_QUOTER_ADDRESS } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
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

type MarketLeg = {
  marketQuote: Address;
  hookKey: V4PoolKey;
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

function marketQuoteFromKey(hookKey: V4PoolKey, token: Address): Address {
  const t = token.toLowerCase();
  if (hookKey.currency0.toLowerCase() === t) return hookKey.currency1;
  return hookKey.currency0;
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

/** Prefer on-chain PoolKeys from the factory — reconstructed keys often miss the fee flag. */
async function loadMarketLegs(
  client: PublicClient,
  pool: TokenPool,
): Promise<MarketLeg[]> {
  const token = pool.contractAddress as Address | undefined;
  if (!token) return [];

  const factory = getLaunchFactoryAddress();
  const launchId = pool.launchId;
  const marketCount = pool.marketCount ?? pool.markets?.length ?? 1;

  if (factory && launchId != null && marketCount > 0) {
    const results = await client.multicall({
      contracts: Array.from({ length: marketCount }, (_, i) => ({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "poolKeyOfMarket" as const,
        args: [BigInt(launchId), BigInt(i)] as const,
      })),
      allowFailure: true,
    });

    const legs: MarketLeg[] = [];
    for (const r of results) {
      if (r.status !== "success" || !r.result) continue;
      const raw = r.result as {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
      };
      const hookKey: V4PoolKey = {
        currency0: raw.currency0,
        currency1: raw.currency1,
        fee: Number(raw.fee),
        tickSpacing: Number(raw.tickSpacing),
        hooks: raw.hooks,
      };
      legs.push({
        marketQuote: marketQuoteFromKey(hookKey, token),
        hookKey,
      });
    }
    if (legs.length > 0) return legs;
  }

  // Fallback: reconstruct from UI markets (may fail to quote if fee is wrong).
  const quotes = multiPoolMarketQuotes(pool);
  return quotes
    .map((marketQuote) => {
      const hookKey =
        poolKeyForQuote(pool, marketQuote) ?? poolKeyFromLaunch(pool, marketQuote);
      return hookKey ? { marketQuote, hookKey } : null;
    })
    .filter((x): x is MarketLeg => x != null);
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

async function quoteBuyLegWithKey(
  client: PublicClient,
  pool: TokenPool,
  payment: PaymentAsset,
  amountIn: bigint,
  leg: MarketLeg,
  recipient: Address,
): Promise<BestBuyLeg | null> {
  const token = pool.contractAddress as Address | undefined;
  if (!token || amountIn <= BigInt(0)) return null;

  const pay = payment.address;
  const { marketQuote, hookKey } = leg;
  const midLabel = quoteLabel(pool, marketQuote);

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
  const token = pool.contractAddress as Address | undefined;
  if (!token) return null;

  const want = receiveCurrency(receive);
  const legs = await loadMarketLegs(client, pool);
  const candidates: BestSellRoute[] = [];

  await Promise.all(
    legs.map(async ({ marketQuote, hookKey }) => {
      const amountOut = await quoteExactInOnKey(
        client,
        hookKey,
        token,
        "sell",
        amountIn,
        recipient,
      );
      if (!amountOut) return;

      const midLabel = quoteLabel(pool, marketQuote);

      if (marketQuote.toLowerCase() === want.toLowerCase()) {
        candidates.push({
          kind: "direct",
          marketQuote,
          hookKey,
          amountOut,
          routeLabel: `${pool.ticker} → ${receive.symbol}`,
        });
        return;
      }

      const bridge = await findBridgeRoute(client, marketQuote, want, amountOut);
      if (!bridge || bridge.amountOut <= BigInt(0)) return;

      candidates.push({
        kind: "composite",
        marketQuote,
        hookKey,
        bridge,
        amountOut: bridge.amountOut,
        intermediateOut: amountOut,
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

  const legs = await loadMarketLegs(client, pool);
  const singles: BestBuyLeg[] = [];

  await Promise.all(
    legs.map(async (leg) => {
      const quoted = await quoteBuyLegWithKey(client, pool, payment, amountIn, leg, recipient);
      if (quoted) singles.push(quoted);
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
  const legAMeta = legs.find((l) => l.marketQuote.toLowerCase() === a.marketQuote.toLowerCase());
  const legBMeta = legs.find((l) => l.marketQuote.toLowerCase() === b.marketQuote.toLowerCase());
  if (!legAMeta || !legBMeta) return bestPlan;

  for (const bps of SPLIT_BPS) {
    const amountA = (amountIn * BigInt(bps)) / 10_000n;
    const amountB = amountIn - amountA;
    if (amountA <= 0n || amountB <= 0n) continue;

    const [legA, legB] = await Promise.all([
      quoteBuyLegWithKey(client, pool, payment, amountA, legAMeta, recipient),
      quoteBuyLegWithKey(client, pool, payment, amountB, legBMeta, recipient),
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

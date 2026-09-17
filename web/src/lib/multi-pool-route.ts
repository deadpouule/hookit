import { type Address, type Hex, type PublicClient, zeroAddress } from "viem";

import { STABLE_QUOTE_ADDRESS, V4_QUOTER_ADDRESS } from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { resolveMasterLaunch } from "@/lib/launches";
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
      /** On-chain `poolKeyOfMarket` index. Missing when reconstructed from UI markets. */
      marketIndex?: number;
    }
  | {
      kind: "composite";
      marketQuote: Address;
      hookKey: V4PoolKey;
      bridge: BridgeRoute;
      amountOut: bigint;
      intermediateOut: bigint;
      routeLabel: string;
      marketIndex?: number;
    };

export type BestBuyLeg =
  | {
      kind: "direct";
      marketQuote: Address;
      hookKey: V4PoolKey;
      amountIn: bigint;
      amountOut: bigint;
      routeLabel: string;
      marketIndex?: number;
    }
  | {
      kind: "composite";
      marketQuote: Address;
      hookKey: V4PoolKey;
      bridge: BridgeRoute;
      amountIn: bigint;
      amountOut: bigint;
      routeLabel: string;
      marketIndex?: number;
    };

export type BestBuyPlan = {
  legs: BestBuyLeg[];
  amountOut: bigint;
  routeLabel: string;
};

export type BestSellLeg = BestSellRoute & { amountIn: bigint };

export type BestSellPlan = {
  legs: BestSellLeg[];
  amountOut: bigint;
  routeLabel: string;
  /** Full-size best single market; used when aggregator execution is unavailable. */
  bestSingle: BestSellLeg;
};

type MarketLeg = {
  marketQuote: Address;
  hookKey: V4PoolKey;
  /** Set only when loaded from `LaunchFactory.poolKeyOfMarket`. */
  marketIndex?: number;
};

const SPLIT_BPS = [3_000, 4_000, 5_000, 6_000, 7_000] as const;
const UINT128_MAX = (1n << 128n) - 1n;
const MARKET_LEGS_TTL_MS = 20_000;
const QUOTE_TIMEOUT_MS = 5_000;

type CachedMarketLegs = { expires: number; legs: MarketLeg[] };
const marketLegsCache = new Map<string, CachedMarketLegs>();

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

async function withQuoteTimeout<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), QUOTE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work.then((value) => value, () => null), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function quoteExactInOnKey(
  client: PublicClient,
  hookKey: V4PoolKey,
  token: Address,
  side: "buy" | "sell",
  amountIn: bigint,
  recipient: Address,
): Promise<bigint | null> {
  if (amountIn <= 0n || amountIn > UINT128_MAX) return null;
  const zeroForOne = hookSwapDirection(hookKey, token, side);
  const hookData = hookRecipientData(recipient);
  const raced = await withQuoteTimeout(
    client.simulateContract({
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
    }),
  );
  if (!raced) return null;
  const amountOut = raced.result[0] as bigint;
  return amountOut > BigInt(0) ? amountOut : null;
}

/** Prefer on-chain PoolKeys from the factory - reconstructed keys often miss the fee flag. */
async function loadMarketLegs(
  client: PublicClient,
  pool: TokenPool,
): Promise<MarketLeg[]> {
  const token = pool.contractAddress as Address | undefined;
  if (!token) return [];

  const cacheKey = `${token.toLowerCase()}:${pool.launchId ?? ""}:${pool.marketCount ?? pool.markets?.length ?? 0}`;
  const cached = marketLegsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.legs;

  const resolved = await resolveMasterLaunch(client, token);
  const launchId = resolved?.launchId ?? (pool.launchId != null ? BigInt(pool.launchId) : null);
  const factory = resolved?.factory;
  const marketCount = pool.marketCount ?? pool.markets?.length ?? 1;

  let legs: MarketLeg[] = [];
  if (factory && launchId != null && launchId > BigInt(0) && marketCount > 0) {
    const results = await client.multicall({
      contracts: Array.from({ length: marketCount }, (_, i) => ({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "poolKeyOfMarket" as const,
        args: [launchId, BigInt(i)] as const,
      })),
      allowFailure: true,
    });

    results.forEach((r, i) => {
      if (r.status !== "success" || !r.result) return;
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
        marketIndex: i,
      });
    });
  }

  if (legs.length === 0) {
    const quotes = multiPoolMarketQuotes(pool);
    legs = quotes
      .map((marketQuote) => {
        const hookKey =
          poolKeyForQuote(pool, marketQuote) ?? poolKeyFromLaunch(pool, marketQuote);
        return hookKey ? { marketQuote, hookKey } : null;
      })
      .filter((x): x is MarketLeg => x != null);
  }

  if (legs.length > 0) {
    marketLegsCache.set(cacheKey, { expires: Date.now() + MARKET_LEGS_TTL_MS, legs });
  }
  return legs;
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
      marketIndex: leg.marketIndex,
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
    marketIndex: leg.marketIndex,
  };
}

async function quoteSellLegWithKey(
  client: PublicClient,
  pool: TokenPool,
  amountIn: bigint,
  receive: SwapAsset,
  recipient: Address,
  token: Address,
  want: Address,
  leg: MarketLeg,
): Promise<BestSellLeg | null> {
  const { marketQuote, hookKey, marketIndex } = leg;
  const amountOut = await quoteExactInOnKey(
    client,
    hookKey,
    token,
    "sell",
    amountIn,
    recipient,
  );
  if (!amountOut) return null;

  const midLabel = quoteLabel(pool, marketQuote);

  if (marketQuote.toLowerCase() === want.toLowerCase()) {
    return {
      kind: "direct",
      marketQuote,
      hookKey,
      amountIn,
      amountOut,
      routeLabel: `${pool.ticker} → ${receive.symbol}`,
      marketIndex,
    };
  }

  const bridge = await findBridgeRoute(client, marketQuote, want, amountOut);
  if (!bridge || bridge.amountOut <= BigInt(0)) return null;

  return {
    kind: "composite",
    marketQuote,
    hookKey,
    bridge,
    amountIn,
    amountOut: bridge.amountOut,
    intermediateOut: amountOut,
    routeLabel: `${pool.ticker} → ${midLabel} → ${receive.symbol}`,
    marketIndex,
  };
}

function pickBestSellLeg(legs: BestSellLeg[]): BestSellLeg {
  return [...legs].sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1))[0]!;
}

type QuoteSellLeg = (leg: MarketLeg, amountIn: bigint) => Promise<BestSellLeg | null>;

/** Equal N-way clip. Never retries a single market at 100% — that dump hangs the V4 quoter. */
async function quoteEqualSplitOnLegs(
  quoteLeg: QuoteSellLeg,
  amountIn: bigint,
  legs: MarketLeg[],
): Promise<BestSellLeg[] | null> {
  if (legs.length < 2 || amountIn <= 0n) return null;
  const n = BigInt(legs.length);
  const slice = amountIn / n;
  if (slice <= 0n) return null;

  const quoted = await Promise.all(
    legs.map((leg, i) => {
      const amt = i === legs.length - 1 ? amountIn - slice * (n - 1n) : slice;
      return quoteLeg(leg, amt);
    }),
  );
  if (quoted.every((q): q is BestSellLeg => q != null)) return quoted;

  const working = legs.filter((_, i) => quoted[i] != null);
  if (working.length >= 2 && working.length < legs.length) {
    return quoteEqualSplitOnLegs(quoteLeg, amountIn, working);
  }
  return null;
}

function splitSellPlan(
  legs: BestSellLeg[],
  routeLabel: string,
  bestSingle: BestSellLeg,
): BestSellPlan {
  return {
    legs,
    amountOut: legs.reduce((sum, leg) => sum + leg.amountOut, 0n),
    routeLabel,
    bestSingle,
  };
}

export function planFilledIn(plan: BestSellPlan): bigint {
  return plan.legs.reduce((sum, leg) => sum + leg.amountIn, 0n);
}

/** Same size as the working 50% preset — 75% still dumps too hard and hangs the quoter. */
async function quoteLargestPartialClip(
  quoteLeg: QuoteSellLeg,
  amountIn: bigint,
  legs: MarketLeg[],
): Promise<BestSellLeg | null> {
  const half = amountIn / 2n;
  if (half <= 0n || legs.length === 0) return null;
  const probed = await Promise.all(legs.map((leg) => quoteLeg(leg, half)));
  const ok = probed.filter((q): q is BestSellLeg => q != null);
  if (ok.length === 0) return null;
  ok.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1));
  return ok[0] ?? null;
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
  const plan = await quoteBestSellPlan(client, pool, amountIn, receive, recipient);
  return plan?.bestSingle ?? null;
}

/**
 * Best sell plan. Full-size dumps into a thin stock pool hang the V4 quoter
 * (MAX waits minutes, 50% returns). Quote equal clips and a 50% single first.
 */
export async function quoteBestSellPlan(
  client: PublicClient,
  pool: TokenPool,
  amountIn: bigint,
  receive: SwapAsset,
  recipient: Address = zeroAddress,
): Promise<BestSellPlan | null> {
  if (amountIn <= BigInt(0)) return null;
  const token = pool.contractAddress as Address | undefined;
  if (!token) return null;

  const want = receiveCurrency(receive);
  const legs = await loadMarketLegs(client, pool);
  if (legs.length === 0) return null;

  const quoteLeg: QuoteSellLeg = (leg, amt) =>
    quoteSellLegWithKey(client, pool, amt, receive, recipient, token, want, leg);

  const splitToStable = want.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase();

  const quoteFullSingles = async (): Promise<BestSellLeg[]> => {
    const results = await Promise.all(legs.map((leg) => quoteLeg(leg, amountIn)));
    const singles = results.filter((q): q is BestSellLeg => q != null);
    singles.sort((a, b) => (a.amountOut > b.amountOut ? -1 : 1));
    return singles;
  };

  // Multi USDG: never wait on 100% dumps. Those freeze MAX even when 50% quotes.
  if (splitToStable && legs.length >= 2) {
    const [equalLegs, partial] = await Promise.all([
      quoteEqualSplitOnLegs(quoteLeg, amountIn, legs),
      quoteLargestPartialClip(quoteLeg, amountIn, legs),
    ]);

    let bestPlan: BestSellPlan | null = null;
    if (equalLegs) {
      bestPlan = splitSellPlan(
        equalLegs,
        `Split equal · ${equalLegs.map((l) => quoteLabel(pool, l.marketQuote)).join(" + ")}`,
        pickBestSellLeg(equalLegs),
      );
    }
    if (partial && (!bestPlan || partial.amountOut > bestPlan.amountOut)) {
      bestPlan = {
        legs: [partial],
        amountOut: partial.amountOut,
        routeLabel: partial.routeLabel,
        bestSingle: partial,
      };
    }

    if (legs.length === 2) {
      const pairA = legs[0];
      const pairB = legs[1];
      if (pairA && pairB) {
        const pairPlans = await Promise.all(
          SPLIT_BPS.map(async (bps) => {
            const amountA = (amountIn * BigInt(bps)) / 10_000n;
            const amountB = amountIn - amountA;
            if (amountA <= 0n || amountB <= 0n) return null;
            const [legA, legB] = await Promise.all([
              quoteLeg(pairA, amountA),
              quoteLeg(pairB, amountB),
            ]);
            if (!legA || !legB) return null;
            const pctA = Math.round(bps / 100);
            return splitSellPlan(
              [legA, legB],
              `Split ${pctA}/${100 - pctA}% · ${legA.routeLabel} + ${legB.routeLabel}`,
              bestPlan?.bestSingle ?? pickBestSellLeg([legA, legB]),
            );
          }),
        );
        for (const plan of pairPlans) {
          if (plan && (!bestPlan || plan.amountOut > bestPlan.amountOut)) {
            bestPlan = plan;
          }
        }
      }
    }

    return bestPlan;
  }

  const singles = await quoteFullSingles();
  if (!singles[0]) return null;
  return {
    legs: [singles[0]],
    amountOut: singles[0].amountOut,
    routeLabel: singles[0].routeLabel,
    bestSingle: singles[0],
  };
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

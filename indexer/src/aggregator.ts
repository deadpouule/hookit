/**
 * DEX aggregator routing (replaces the retired multi-pair arb keeper).
 *
 * User-facing swaps route through BalancedAggregator on Ink. The indexer does not
 * rebalance pools on-chain; it documents the typed interface operators and
 * keepers should expect when quoting or simulating aggregator paths.
 *
 * Frontend reference: `web/src/lib/multi-pool-route.ts`, `web/src/lib/balanced-aggregator-route.ts`.
 */

import type { Address, Hex, PublicClient } from "viem";

/** One leg of a BalancedAggregator split route (factory market index, not UI bps sort). */
export type AggregatorRouteLeg = {
  /** `LaunchFactory.poolKeyOfMarket(launchId, marketIndex)` — sequential factory order. */
  marketIndex: number;
  amountIn: bigint;
  minAmountOut: bigint;
};

/** Quote result for a multi-market sell (token → quote, optionally via Quotrons bridge). */
export type AggregatorSellQuote = {
  launchId: bigint;
  token: Address;
  legs: AggregatorRouteLeg[];
  amountOut: bigint;
  routeLabel: string;
};

/** Quote result for a multi-market buy (quote → token). */
export type AggregatorBuyQuote = {
  launchId: bigint;
  token: Address;
  legs: AggregatorRouteLeg[];
  amountOut: bigint;
  routeLabel: string;
};

export type AggregatorRpcConfig = {
  /** Ordered RPC URLs — first healthy endpoint wins; rotate on 429 / timeout. */
  rpcUrls: readonly string[];
  /** Per-call timeout (ms) for quoter / simulate reads. */
  quoteTimeoutMs: number;
  /** Max parallel market quotes when comparing single vs split routes. */
  maxParallelQuotes: number;
};

export const DEFAULT_AGGREGATOR_RPC: AggregatorRpcConfig = {
  rpcUrls: [
    "https://rpc-gel.inkonchain.com",
    "https://rpc-qnd.inkonchain.com",
  ],
  quoteTimeoutMs: 12_000,
  maxParallelQuotes: 5,
};

/** Env-driven aggregator contract (Ink mainnet default from deploy/ink/addresses.json). */
export function balancedAggregatorAddress(): Address | undefined {
  const raw =
    process.env.BALANCED_AGGREGATOR?.trim() ??
    process.env.NEXT_PUBLIC_BALANCED_AGGREGATOR?.trim();
  if (!raw || raw === "0x") return undefined;
  return raw as Address;
}

/**
 * Split routing policy mirrored from the web SDK:
 * - compare best single-market fill vs equal N-way and 60/40 top-two splits;
 * - pick split only when it strictly beats the best single leg (non-regressive).
 */
export type SplitRoutingPolicy = {
  enabled: boolean;
  /** Bps splits tried for two-leg routes (e.g. 6000 = 60% on leg A). */
  twoLegSplitBps: readonly number[];
  /** Equal N-way splits up to this many markets. */
  maxSplitLegs: number;
};

export const DEFAULT_SPLIT_POLICY: SplitRoutingPolicy = {
  enabled: true,
  twoLegSplitBps: [3_000, 4_000, 5_000, 6_000, 7_000],
  maxSplitLegs: 5,
};

/**
 * Execution fallback when `BalancedAggregator.sellExactInput` / `buyExactInput` simulation fails:
 * run the same best single leg through HookitSwapRouter composite routing (hook + Quotrons bridge).
 */
export type AggregatorExecutionFallback = "composite-router" | "none";

export type AggregatorExecutionPlan = {
  aggregator: Address;
  launchId: bigint;
  legs: AggregatorRouteLeg[];
  deadline: bigint;
  fallback: AggregatorExecutionFallback;
};

/** Lightweight health probe — confirms RPC + aggregator bytecode is deployed. */
export async function probeAggregatorDeployment(
  client: PublicClient,
  aggregator?: Address,
): Promise<{ ok: boolean; address?: Address; bytecodeSize?: number }> {
  const addr = aggregator ?? balancedAggregatorAddress();
  if (!addr) return { ok: false };
  const code = await client.getBytecode({ address: addr });
  const size = code ? (code.length - 2) / 2 : 0;
  return { ok: size > 0, address: addr, bytecodeSize: size };
}

/** Human-readable summary for indexer / keeper logs. */
export function formatAggregatorRoute(quote: AggregatorSellQuote | AggregatorBuyQuote): string {
  const legs = quote.legs
    .map((l) => `m${l.marketIndex}:${l.amountIn.toString()}`)
    .join(" + ");
  return `${quote.routeLabel} [${legs}] → ${quote.amountOut.toString()}`;
}

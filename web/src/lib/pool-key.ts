import type { Address } from "viem";
import { zeroAddress } from "viem";

import { DEFAULT_TICK_SPACING } from "@/lib/contracts/config";
import { poolQuoteAddress } from "@/lib/payment-assets";
import type { TokenPool } from "@/lib/types";

/** Uniswap v4 dynamic LP fee flag (`LPFeeLibrary.DYNAMIC_FEE_FLAG`). */
export const DYNAMIC_FEE_FLAG = 0x80_0000;

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

/** Resolve pool fee — dynamic launches must use 0x800000 or PoolId hashes diverge. */
export function resolvePoolLpFee(pool: TokenPool): number {
  // Prefer the dynamic flag whenever the module bit is set — never trust a stale
  // static lpFee of 0 (indexer/UI hydration bug) which makes the quoter miss the pool.
  if (pool.hooks?.dynamicFees) return DYNAMIC_FEE_FLAG;
  if (pool.lpFee === DYNAMIC_FEE_FLAG) return DYNAMIC_FEE_FLAG;
  if (pool.lpFee != null && pool.lpFee > 0) return pool.lpFee;
  return 0;
}

export function poolKeyFromLaunch(
  pool: TokenPool,
  quoteOverride?: Address,
): V4PoolKey | null {
  const token = pool.contractAddress as Address | undefined;
  const hooks = pool.hooksAddress;
  if (!token || !hooks) return null;

  const quote = (quoteOverride ?? pool.quoteAddress ?? zeroAddress) as Address;
  const tokenIs0 = pool.tokenIsCurrency0 ?? BigInt(token) < BigInt(quote);

  return {
    currency0: tokenIs0 ? token : quote,
    currency1: tokenIs0 ? quote : token,
    fee: resolvePoolLpFee(pool),
    tickSpacing: pool.tickSpacing ?? DEFAULT_TICK_SPACING,
    hooks,
  };
}

/**
 * Pool key for a payment/receive quote on multi-market launches.
 * Returns null when the quote is not a direct market (caller should bridge).
 */
export function poolKeyForQuote(pool: TokenPool, quote: Address): V4PoolKey | null {
  const q = quote.toLowerCase();
  const markets = pool.markets ?? [];
  if (markets.length > 0) {
    const match = markets.find((m) => m.quoteAddress.toLowerCase() === q);
    if (match) return poolKeyFromLaunch(pool, match.quoteAddress);
    return null;
  }
  if (poolQuoteAddress(pool).toLowerCase() === q) return poolKeyFromLaunch(pool);
  return null;
}

/** True when `quote` is a direct market on this pool (primary or multi-market leg). */
export function poolHasQuoteMarket(pool: TokenPool, quote: Address): boolean {
  const q = quote.toLowerCase();
  if (poolQuoteAddress(pool).toLowerCase() === q) return true;
  return (pool.markets ?? []).some((m) => m.quoteAddress.toLowerCase() === q);
}

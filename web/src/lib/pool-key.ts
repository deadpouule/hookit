import type { Address } from "viem";

import { DEFAULT_TICK_SPACING } from "@/lib/contracts/config";
import type { TokenPool } from "@/lib/types";

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export function poolKeyFromLaunch(pool: TokenPool): V4PoolKey | null {
  const token = pool.contractAddress as Address | undefined;
  const hooks = pool.hooksAddress;
  if (!token || !hooks) return null;

  const quote = (pool.quoteAddress ?? "0x0000000000000000000000000000000000000000") as Address;
  const tokenIs0 = pool.tokenIsCurrency0 ?? BigInt(token) < BigInt(quote);

  return {
    currency0: tokenIs0 ? token : quote,
    currency1: tokenIs0 ? quote : token,
    fee: pool.lpFee ?? 0,
    tickSpacing: pool.tickSpacing ?? DEFAULT_TICK_SPACING,
    hooks,
  };
}

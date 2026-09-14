import type { Address, PublicClient } from "viem";

import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { estimateLaunchBlock, sumLogsChunked } from "@/lib/log-range";

const CACHE_TTL_MS = 45_000;

const lpDeepenedEvent = masterLaunchHookAbi.find(
  (item) => item.type === "event" && item.name === "LpDeepened",
)!;

type CacheEntry = { total: bigint; at: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(hook: Address, poolId: `0x${string}`): string {
  return `${hook}:${poolId}`.toLowerCase();
}

export function invalidateDeepenLpsAdded(hook: Address, poolId: `0x${string}`): void {
  cache.delete(cacheKey(hook, poolId));
}

/**
 * Quote already minted into the launch LP range (sum of `LpDeepened`).
 * Not the pending queue - that sits in `pendingDeepenLps` until the next afterSwap.
 */
export async function fetchDeepenLpsAdded(
  client: PublicClient,
  hook: Address,
  poolId: `0x${string}`,
  launchedAt?: number,
): Promise<bigint> {
  const key = cacheKey(hook, poolId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.total;

  const latest = await client.getBlockNumber();
  const fromBlock = estimateLaunchBlock(latest, launchedAt);

  const sum = (logs: { args: { quoteAmount?: bigint } }[]) =>
    logs.reduce((acc, log) => acc + (log.args.quoteAmount ?? 0n), 0n);

  const fetchRange = async (start: bigint, end: bigint) =>
    sum(
      await client.getLogs({
        address: hook,
        event: lpDeepenedEvent,
        args: { poolId },
        fromBlock: start,
        toBlock: end,
      }),
    );

  const { total } = await sumLogsChunked({ fromBlock, latest, fetchRange });

  cache.set(key, { total, at: Date.now() });
  return total;
}

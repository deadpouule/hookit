import type { Address, PublicClient } from "viem";

import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";

/** Ink produces ~1 block/s; pad the estimate so the launch block is never missed. */
const INK_BLOCK_SECONDS = 1;
const LAUNCH_BLOCK_MARGIN = 20_000n;
/** Public Ink RPCs reject eth_getLogs ranges above 10k blocks. */
const MAX_LOG_RANGE = 10_000n;
const FALLBACK_CHUNK = 9_000n;
const FALLBACK_MAX_CHUNKS = 48;
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
  let fromBlock = 0n;
  if (launchedAt && launchedAt > 1_000_000_000) {
    const ageBlocks = BigInt(Math.max(0, Math.floor((Date.now() / 1000 - launchedAt) / INK_BLOCK_SECONDS)));
    const back = ageBlocks + LAUNCH_BLOCK_MARGIN;
    fromBlock = latest > back ? latest - back : 0n;
  }

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

  let total = 0n;
  const span = latest >= fromBlock ? latest - fromBlock : 0n;
  let singleShotOk = false;
  if (span <= MAX_LOG_RANGE) {
    try {
      total = await fetchRange(fromBlock, latest);
      singleShotOk = true;
    } catch {
      singleShotOk = false;
    }
  }
  if (!singleShotOk) {
    total = 0n;
    let end = latest;
    for (let i = 0; i < FALLBACK_MAX_CHUNKS && end >= fromBlock; i += 1) {
      const start = end > FALLBACK_CHUNK ? end - FALLBACK_CHUNK + 1n : 0n;
      try {
        total += await fetchRange(start < fromBlock ? fromBlock : start, end);
      } catch {
        break;
      }
      if (start === 0n || start <= fromBlock) break;
      end = start - 1n;
    }
  }

  cache.set(key, { total, at: Date.now() });
  return total;
}

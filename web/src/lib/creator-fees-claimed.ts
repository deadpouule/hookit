import type { Address, PublicClient } from "viem";

import { feeEscrowAbi } from "@/lib/contracts/swap-abi";

/** Ink produces ~1 block/s; pad the estimate so the launch block is never missed. */
const INK_BLOCK_SECONDS = 1;
const LAUNCH_BLOCK_MARGIN = 20_000n;
const FALLBACK_CHUNK = 50_000n;
const FALLBACK_MAX_CHUNKS = 12;
const CACHE_TTL_MS = 60_000;

const claimedEvent = feeEscrowAbi.find((item) => item.type === "event" && item.name === "Claimed")!;

type CacheEntry = { total: bigint; at: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(escrow: Address, creator: Address, quote: Address): string {
  return `${escrow}:${creator}:${quote}`.toLowerCase();
}

export function invalidateCreatorClaimed(escrow: Address, creator: Address, quote: Address): void {
  cache.delete(cacheKey(escrow, creator, quote));
}

/**
 * Total quote the creator has already pulled out of FeeEscrow (sum of `Claimed` logs).
 * Scans from an estimated launch block; falls back to chunked reads when the RPC rejects wide ranges.
 */
export async function fetchCreatorClaimedTotal(
  client: PublicClient,
  escrow: Address,
  creator: Address,
  quote: Address,
  launchedAt?: number,
): Promise<bigint> {
  const key = cacheKey(escrow, creator, quote);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.total;

  const latest = await client.getBlockNumber();
  let fromBlock = 0n;
  if (launchedAt && launchedAt > 1_000_000_000) {
    const ageBlocks = BigInt(Math.max(0, Math.floor((Date.now() / 1000 - launchedAt) / INK_BLOCK_SECONDS)));
    const back = ageBlocks + LAUNCH_BLOCK_MARGIN;
    fromBlock = latest > back ? latest - back : 0n;
  }

  const sum = (logs: { args: { amount?: bigint } }[]) =>
    logs.reduce((acc, log) => acc + (log.args.amount ?? 0n), 0n);

  let total = 0n;
  try {
    const logs = await client.getLogs({
      address: escrow,
      event: claimedEvent,
      args: { account: creator, currency: quote },
      fromBlock,
      toBlock: latest,
    });
    total = sum(logs);
  } catch {
    // Wide range rejected — walk backwards in chunks over the most recent window.
    let end = latest;
    for (let i = 0; i < FALLBACK_MAX_CHUNKS && end >= fromBlock; i += 1) {
      const start = end > FALLBACK_CHUNK ? end - FALLBACK_CHUNK + 1n : 0n;
      try {
        const logs = await client.getLogs({
          address: escrow,
          event: claimedEvent,
          args: { account: creator, currency: quote },
          fromBlock: start < fromBlock ? fromBlock : start,
          toBlock: end,
        });
        total += sum(logs);
      } catch {
        break;
      }
      if (start === 0n) break;
      end = start - 1n;
    }
  }

  cache.set(key, { total, at: Date.now() });
  return total;
}

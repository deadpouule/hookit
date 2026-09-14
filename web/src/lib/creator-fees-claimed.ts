import type { Address, PublicClient } from "viem";

import { feeEscrowAbi } from "@/lib/contracts/swap-abi";
import { estimateLaunchBlock, sumLogsChunked } from "@/lib/log-range";

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
 * Scans from an estimated launch block in RPC-sized chunks (public Ink nodes cap getLogs at 10k blocks).
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
  const fromBlock = estimateLaunchBlock(latest, launchedAt);

  const sum = (logs: { args: { amount?: bigint } }[]) =>
    logs.reduce((acc, log) => acc + (log.args.amount ?? 0n), 0n);

  const { total } = await sumLogsChunked({
    fromBlock,
    latest,
    fetchRange: async (start, end) =>
      sum(
        await client.getLogs({
          address: escrow,
          event: claimedEvent,
          args: { account: creator, currency: quote },
          fromBlock: start,
          toBlock: end,
        }),
      ),
  });

  cache.set(key, { total, at: Date.now() });
  return total;
}

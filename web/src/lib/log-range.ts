/** Public Ink RPCs reject eth_getLogs ranges above 10k blocks. */
export const MAX_LOG_RANGE = 10_000n;
export const LOG_CHUNK = 9_000n;
const DEFAULT_MAX_CHUNKS = 48;
const DEFAULT_CONCURRENCY = 6;

/** Ink produces ~1 block/s; pad the estimate so the launch block is never missed. */
const INK_BLOCK_SECONDS = 1;
const LAUNCH_BLOCK_MARGIN = 20_000n;

/** Lower bound for a scan that must include the launch tx. Unknown launch time → genesis. */
export function estimateLaunchBlock(latest: bigint, launchedAt?: number, nowMs = Date.now()): bigint {
  if (!launchedAt || launchedAt <= 1_000_000_000) return 0n;
  const ageBlocks = BigInt(Math.max(0, Math.floor((nowMs / 1000 - launchedAt) / INK_BLOCK_SECONDS)));
  const back = ageBlocks + LAUNCH_BLOCK_MARGIN;
  return latest > back ? latest - back : 0n;
}

/**
 * Inclusive [start, end] ranges walking forward from `fromBlock`, each within the RPC cap.
 * Use when the first match is expected near the start (e.g. a dev buy right after launch).
 */
export function forwardLogRanges(
  fromBlock: bigint,
  latest: bigint,
  chunk = LOG_CHUNK,
  maxChunks = DEFAULT_MAX_CHUNKS,
): Array<[bigint, bigint]> {
  const ranges: Array<[bigint, bigint]> = [];
  let start = fromBlock;
  while (ranges.length < maxChunks && start <= latest) {
    const end = start + chunk - 1n < latest ? start + chunk - 1n : latest;
    ranges.push([start, end]);
    start = end + 1n;
  }
  return ranges;
}

export type ChunkedLogSumOptions = {
  fromBlock: bigint;
  latest: bigint;
  /** Sums one inclusive block range; throws when the RPC rejects it. */
  fetchRange: (start: bigint, end: bigint) => Promise<bigint>;
  maxRange?: bigint;
  chunk?: bigint;
  maxChunks?: number;
  concurrency?: number;
};

export type ChunkedLogSum = {
  total: bigint;
  /** False when a chunk failed or `maxChunks` ran out before reaching `fromBlock`. */
  complete: boolean;
};

/**
 * Sum event amounts over [fromBlock, latest]. Tries a single request when the span fits the RPC
 * cap, otherwise walks backwards from `latest` in fixed chunks, `concurrency` requests at a time,
 * so a days-old launch resolves in a few round trips instead of one request per chunk.
 */
export async function sumLogsChunked(options: ChunkedLogSumOptions): Promise<ChunkedLogSum> {
  const {
    fromBlock,
    latest,
    fetchRange,
    maxRange = MAX_LOG_RANGE,
    chunk = LOG_CHUNK,
    maxChunks = DEFAULT_MAX_CHUNKS,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  if (latest < fromBlock) return { total: 0n, complete: true };

  if (latest - fromBlock <= maxRange) {
    try {
      return { total: await fetchRange(fromBlock, latest), complete: true };
    } catch {
      // Provider tighter than expected - fall through to chunks.
    }
  }

  const ranges: Array<[bigint, bigint]> = [];
  let end = latest;
  while (ranges.length < maxChunks && end >= fromBlock) {
    const start = end >= fromBlock + chunk ? end - chunk + 1n : fromBlock;
    ranges.push([start, end]);
    if (start <= fromBlock) break;
    end = start - 1n;
  }
  const reachedFrom = ranges.length > 0 && ranges[ranges.length - 1]![0] <= fromBlock;

  let total = 0n;
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(([start, stop]) => fetchRange(start, stop)));
    for (const result of results) {
      if (result.status === "rejected") return { total, complete: false };
      total += result.value;
    }
  }
  return { total, complete: reachedFrom };
}

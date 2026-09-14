import assert from "node:assert/strict";
import test from "node:test";

import { MAX_LOG_RANGE, sumLogsChunked } from "./log-range";

type Call = [bigint, bigint];

function recorder(onRange: (start: bigint, end: bigint) => bigint) {
  const calls: Call[] = [];
  return {
    calls,
    fetchRange: async (start: bigint, end: bigint) => {
      calls.push([start, end]);
      return onRange(start, end);
    },
  };
}

test("sumLogsChunked uses a single request when the span fits the RPC cap", async () => {
  const { calls, fetchRange } = recorder(() => 7n);
  const out = await sumLogsChunked({ fromBlock: 100n, latest: 100n + MAX_LOG_RANGE, fetchRange });
  assert.deepEqual(out, { total: 7n, complete: true });
  assert.deepEqual(calls, [[100n, 100n + MAX_LOG_RANGE]]);
});

test("sumLogsChunked walks back in RPC-sized chunks covering the whole span exactly once", async () => {
  const { calls, fetchRange } = recorder((start, end) => end - start + 1n);
  const fromBlock = 1_000n;
  const latest = 30_999n; // 30k blocks: three chunks of 9k + one of 3k
  const out = await sumLogsChunked({ fromBlock, latest, fetchRange, chunk: 9_000n });
  assert.equal(out.complete, true);
  assert.equal(out.total, latest - fromBlock + 1n);

  const sorted = [...calls].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  assert.equal(sorted[0]![0], fromBlock);
  assert.equal(sorted[sorted.length - 1]![1], latest);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.equal(sorted[i]![0], sorted[i - 1]![1] + 1n, "chunks must be contiguous");
  }
  for (const [start, end] of calls) {
    assert.ok(end - start + 1n <= 9_000n, "no chunk may exceed the RPC cap");
  }
});

test("sumLogsChunked reports an incomplete scan when a chunk is rejected", async () => {
  let n = 0;
  const { fetchRange } = recorder(() => {
    n += 1;
    if (n === 3) throw new Error("block range greater than 10000 max");
    return 1n;
  });
  const out = await sumLogsChunked({
    fromBlock: 0n,
    latest: 50_000n,
    fetchRange,
    chunk: 9_000n,
    concurrency: 1,
  });
  assert.equal(out.complete, false);
  assert.equal(out.total, 2n);
});

test("sumLogsChunked stops at maxChunks and flags the partial total", async () => {
  const { calls, fetchRange } = recorder(() => 1n);
  const out = await sumLogsChunked({
    fromBlock: 0n,
    latest: 1_000_000n,
    fetchRange,
    chunk: 9_000n,
    maxChunks: 4,
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(out, { total: 4n, complete: false });
  // Most recent blocks are scanned first so a truncated total still reflects recent activity.
  assert.equal(calls[0]![1], 1_000_000n);
});

test("sumLogsChunked falls back to chunks when the single request is rejected", async () => {
  let first = true;
  const { calls, fetchRange } = recorder(() => {
    if (first) {
      first = false;
      throw new Error("range too wide");
    }
    return 1n;
  });
  const out = await sumLogsChunked({ fromBlock: 0n, latest: 5_000n, fetchRange, chunk: 2_000n });
  assert.equal(out.complete, true);
  assert.equal(out.total, 3n);
  assert.equal(calls.length, 4);
});

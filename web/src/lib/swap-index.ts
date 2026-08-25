import {
  type Address,
  type Hex,
  decodeEventLog,
  parseAbiItem,
} from "viem";
import type { PublicClient } from "viem";

import { POOL_MANAGER_ADDRESS } from "@/lib/contracts/config";
import { ethPerTokenFromSqrtPrice } from "@/lib/pool-price";

const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);

export type IndexedSwap = {
  poolId: `0x${string}`;
  blockNumber: number;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
};

export type PoolSwapStats = {
  volumeQuoteWei: bigint;
  change24h: number;
  series: number[];
  trades: number;
};

const cache: {
  toBlock: bigint;
  fromBlock: bigint;
  byPool: Map<string, IndexedSwap[]>;
} = {
  toBlock: BigInt(0),
  fromBlock: BigInt(0),
  byPool: new Map(),
};

const BLOCKS_PER_DAY = 43_200n; // ~2s Base blocks
const MAX_WINDOW = 50_000n;

function abs(n: bigint): bigint {
  return n < BigInt(0) ? -n : n;
}

export async function loadSwapsForPools(
  client: PublicClient,
  poolIds: `0x${string}`[],
): Promise<Map<string, IndexedSwap[]>> {
  if (poolIds.length === 0) return new Map();

  const latest = await client.getBlockNumber();
  const windowStart = latest > MAX_WINDOW ? latest - MAX_WINDOW : BigInt(0);
  let fromBlock = cache.toBlock > BigInt(0) ? cache.toBlock + BigInt(1) : windowStart;
  if (fromBlock < windowStart) {
    cache.byPool.clear();
    fromBlock = windowStart;
  }

  if (fromBlock <= latest) {
    const logs = await client.getLogs({
      address: POOL_MANAGER_ADDRESS,
      event: swapEvent,
      args: { id: poolIds },
      fromBlock,
      toBlock: latest,
    });

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: [swapEvent],
          data: log.data,
          topics: log.topics,
        });
        const args = decoded.args as {
          id: `0x${string}`;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
        };
        const poolId = args.id.toLowerCase() as `0x${string}`;
        const row: IndexedSwap = {
          poolId,
          blockNumber: Number(log.blockNumber ?? 0),
          amount0: args.amount0,
          amount1: args.amount1,
          sqrtPriceX96: args.sqrtPriceX96,
        };
        const list = cache.byPool.get(poolId) ?? [];
        list.push(row);
        cache.byPool.set(poolId, list);
      } catch {
        // ignore malformed logs
      }
    }
    cache.toBlock = latest;
    cache.fromBlock = windowStart;
  }

  const wanted = new Set(poolIds.map((id) => id.toLowerCase()));
  const cutoff = Number(latest > BLOCKS_PER_DAY ? latest - BLOCKS_PER_DAY : BigInt(0));
  const out = new Map<string, IndexedSwap[]>();
  for (const id of wanted) {
    const rows = (cache.byPool.get(id) ?? []).filter((s) => s.blockNumber >= cutoff);
    out.set(id, rows);
  }
  return out;
}

export function statsFromSwaps(
  swaps: IndexedSwap[],
  tokenIsCurrency0: boolean,
): PoolSwapStats {
  if (swaps.length === 0) {
    return { volumeQuoteWei: BigInt(0), change24h: 0, series: [], trades: 0 };
  }

  let volumeQuoteWei = BigInt(0);
  const series: number[] = [];
  for (const swap of swaps) {
    const quoteDelta = tokenIsCurrency0 ? swap.amount1 : swap.amount0;
    volumeQuoteWei += abs(quoteDelta);
    const price = ethPerTokenFromSqrtPrice(swap.sqrtPriceX96, tokenIsCurrency0);
    if (price > 0) series.push(price);
  }

  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? first;
  const change24h = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    volumeQuoteWei,
    change24h,
    series: series.slice(-120),
    trades: swaps.length,
  };
}

export function quoteVolumeUsd(volumeQuoteWei: bigint, quoteIsEth: boolean, ethUsd: number, usdcUsd = 1): number {
  if (quoteIsEth) {
    return (Number(volumeQuoteWei) / 1e18) * ethUsd;
  }
  return (Number(volumeQuoteWei) / 1e6) * usdcUsd;
}

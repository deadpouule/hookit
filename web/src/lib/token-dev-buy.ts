import {
  decodeEventLog,
  formatUnits,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";

import { formatCompactQuoteAmount } from "@/lib/format";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import {
  getBondingFactoryAddress,
  POOL_MANAGER_ADDRESS,
} from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { resolveMasterLaunch } from "@/lib/launches";
import { estimateLaunchBlock, forwardLogRanges, LOG_CHUNK } from "@/lib/log-range";
import type { TokenPool } from "@/lib/types";

export type DevBuyInfo = {
  completed: boolean;
  quoteSpent?: string;
  tokensReceived?: string;
  txHash?: `0x${string}`;
  timestamp?: number;
};

const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);

/** Emitted by LaunchFactory when the launch tx itself carries a dev buy. */
const devBuyExecutedEvent = parseAbiItem(
  "event DevBuyExecuted(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut)",
);

function abs(n: bigint) {
  return n < BigInt(0) ? -n : n;
}

/** Launch tx sits inside the launch-block estimate margin: a few chunks are enough. */
const LAUNCH_WINDOW_CHUNKS = 4;
/** Creator buys after launch: scan roughly the first day of trading. */
const CREATOR_BUY_CHUNKS = 12;

/**
 * Walk forward from the launch block in RPC-sized chunks and stop at the first log `pick` accepts.
 * The dev buy lands in or right after the launch tx, so this usually resolves in one request.
 */
async function firstMatchingLog<T>(
  client: PublicClient,
  launchedAt: number | undefined,
  fetchLogs: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  pick: (log: T) => boolean,
  maxChunks: number,
): Promise<T | null> {
  const latest = await client.getBlockNumber();
  const ranges = forwardLogRanges(estimateLaunchBlock(latest, launchedAt), latest, LOG_CHUNK, maxChunks);
  for (const [start, end] of ranges) {
    const logs = await fetchLogs(start, end);
    const hit = logs.find(pick);
    if (hit) return hit;
  }
  return null;
}

const boughtEvent = parseAbiItem(
  "event Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 feeQuote)",
);

/** First on-chain buy by the token creator (bonding Bought or v4 Swap). */
export async function fetchDevBuyOnChain(
  client: PublicClient,
  pool: TokenPool,
): Promise<DevBuyInfo> {
  const token = (pool.contractAddress ?? pool.address) as Address;
  const creator = pool.creator?.toLowerCase();
  if (!creator) return { completed: false };

  const bonding = getBondingFactoryAddress();

  let launchId: bigint | null = null;

  if (pool.rail === "classic" && bonding) {
    launchId = (await client.readContract({
      address: bonding,
      abi: bondingFactoryAbi,
      functionName: "tokenLaunchId",
      args: [token],
    })) as bigint;
    if (launchId > BigInt(0)) {
      const decodeBought = (log: { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] }) =>
        decodeEventLog({ abi: [boughtEvent], data: log.data, topics: log.topics });
      const hit = await firstMatchingLog(
        client,
        pool.launchedAt,
        (fromBlock, toBlock) =>
          client.getLogs({
            address: bonding,
            event: boughtEvent,
            args: { launchId },
            fromBlock,
            toBlock,
          }),
        (log) => {
          const decoded = decodeBought(log);
          return (
            decoded.eventName === "Bought" &&
            (decoded.args.buyer as string).toLowerCase() === creator
          );
        },
        CREATOR_BUY_CHUNKS,
      );
      if (hit) {
        const decoded = decodeBought(hit);
        const block = hit.blockNumber
          ? await client.getBlock({ blockNumber: hit.blockNumber })
          : null;
        return {
          completed: true,
          quoteSpent: (decoded.args.quoteIn as bigint).toString(),
          tokensReceived: (decoded.args.tokensOut as bigint).toString(),
          txHash: hit.transactionHash,
          timestamp: block ? Number(block.timestamp) : undefined,
        };
      }
    }
    return { completed: false };
  }

  const resolved = await resolveMasterLaunch(client, token);
  if (resolved) {
    launchId = resolved.launchId;
    const launch = await client.readContract({
      address: resolved.factory,
      abi: launchFactoryAbi,
      functionName: "launches",
      args: [launchId],
    }).catch(() => null);

    // Launch-time dev buys are executed by the factory, so the v4 Swap sender is the factory,
    // not the creator: read the factory's own event first.
    const executed = await firstMatchingLog(
      client,
      pool.launchedAt,
      (fromBlock, toBlock) =>
        client.getLogs({
          address: resolved.factory,
          event: devBuyExecutedEvent,
          args: { launchId },
          fromBlock,
          toBlock,
        }),
      () => true,
      LAUNCH_WINDOW_CHUNKS,
    );
    if (executed) {
      const decoded = decodeEventLog({
        abi: [devBuyExecutedEvent],
        data: executed.data,
        topics: executed.topics,
      });
      const block = executed.blockNumber
        ? await client.getBlock({ blockNumber: executed.blockNumber })
        : null;
      return {
        completed: true,
        quoteSpent: (decoded.args.quoteIn as bigint).toString(),
        tokensReceived: (decoded.args.tokensOut as bigint).toString(),
        txHash: executed.transactionHash,
        timestamp: block ? Number(block.timestamp) : undefined,
      };
    }

    const poolId =
      pool.poolId ??
      (launch && Array.isArray(launch) ? (launch[4] as `0x${string}`) : null);
    if (!poolId) return { completed: false };

    const tokenIs0 = pool.tokenIsCurrency0 ?? false;
    const decodeSwap = (log: { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] }) =>
      decodeEventLog({ abi: [swapEvent], data: log.data, topics: log.topics });
    // A creator buy is a swap by the creator that pays quote into the pool (negative quote delta).
    const isCreatorBuy = (decoded: ReturnType<typeof decodeSwap>) => {
      if (decoded.eventName !== "Swap") return false;
      if ((decoded.args.sender as string).toLowerCase() !== creator) return false;
      const quoteDelta = tokenIs0 ? (decoded.args.amount1 as bigint) : (decoded.args.amount0 as bigint);
      return quoteDelta < BigInt(0);
    };

    const hit = await firstMatchingLog(
      client,
      pool.launchedAt,
      (fromBlock, toBlock) =>
        client.getLogs({
          address: POOL_MANAGER_ADDRESS,
          event: swapEvent,
          args: { id: poolId },
          fromBlock,
          toBlock,
        }),
      (log) => isCreatorBuy(decodeSwap(log)),
      CREATOR_BUY_CHUNKS,
    );
    if (hit) {
      const decoded = decodeSwap(hit);
      const amount0 = decoded.args.amount0 as bigint;
      const amount1 = decoded.args.amount1 as bigint;
      const block = hit.blockNumber
        ? await client.getBlock({ blockNumber: hit.blockNumber })
        : null;
      return {
        completed: true,
        quoteSpent: (tokenIs0 ? abs(amount1) : abs(amount0)).toString(),
        tokensReceived: (tokenIs0 ? abs(amount0) : abs(amount1)).toString(),
        txHash: hit.transactionHash,
        timestamp: block ? Number(block.timestamp) : undefined,
      };
    }
  }

  return { completed: false };
}

export function formatDevBuyQuote(raw: string, quoteDecimals: number, quoteLabel: string) {
  const n = Number(formatUnits(BigInt(raw), quoteDecimals));
  const ticker = quoteLabel.trim();
  if (ticker === "ETH") {
    return `${n < 1 ? n.toFixed(4) : n.toFixed(3)} ETH`;
  }
  if (n >= 1) return `${n.toFixed(4)} ${ticker}`;
  return `${formatCompactQuoteAmount(n)} ${ticker}`;
}

export function formatDevBuyTokens(raw: string, decimals: number, symbol: string) {
  const n = Number(formatUnits(BigInt(raw), decimals));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${symbol}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K ${symbol}`;
  return `${n.toFixed(2)} ${symbol}`;
}

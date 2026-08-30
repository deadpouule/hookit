import {
  decodeEventLog,
  formatUnits,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";

import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
  POOL_MANAGER_ADDRESS,
} from "@/lib/contracts/config";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
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

function abs(n: bigint) {
  return n < BigInt(0) ? -n : n;
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
  const factory = getLaunchFactoryAddress();

  let launchId: bigint | null = null;
  let fromBlock = BigInt(0);

  if (pool.rail === "classic" && bonding) {
    launchId = (await client.readContract({
      address: bonding,
      abi: bondingFactoryAbi,
      functionName: "tokenLaunchId",
      args: [token],
    })) as bigint;
    if (launchId > BigInt(0)) {
      const latest = await client.getBlockNumber();
      fromBlock = latest > BigInt(50_000) ? latest - BigInt(50_000) : BigInt(0);
      const logs = await client.getLogs({
        address: bonding,
        event: boughtEvent,
        args: { launchId },
        fromBlock,
        toBlock: "latest",
      });
      for (const log of logs) {
        const decoded = decodeEventLog({
          abi: [boughtEvent],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== "Bought") continue;
        const buyer = (decoded.args.buyer as string).toLowerCase();
        if (buyer !== creator) continue;
        const block = log.blockNumber
          ? await client.getBlock({ blockNumber: log.blockNumber })
          : null;
        return {
          completed: true,
          quoteSpent: (decoded.args.quoteIn as bigint).toString(),
          tokensReceived: (decoded.args.tokensOut as bigint).toString(),
          txHash: log.transactionHash,
          timestamp: block ? Number(block.timestamp) : undefined,
        };
      }
    }
    return { completed: false };
  }

  if (factory) {
    launchId = (await client.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "tokenLaunchId",
      args: [token],
    })) as bigint;
    if (launchId <= BigInt(0)) return { completed: false };

    const launch = await client.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launches",
      args: [launchId],
    }).catch(() => null);

    const poolId =
      pool.poolId ??
      (launch && Array.isArray(launch) ? (launch[4] as `0x${string}`) : null);
    if (!poolId) return { completed: false };

    const latest = await client.getBlockNumber();
    fromBlock = latest > BigInt(50_000) ? latest - BigInt(50_000) : BigInt(0);
    const tokenIs0 = pool.tokenIsCurrency0 ?? false;

    const logs = await client.getLogs({
      address: POOL_MANAGER_ADDRESS,
      event: swapEvent,
      args: { id: poolId },
      fromBlock,
      toBlock: "latest",
    });

    for (const log of logs) {
      const decoded = decodeEventLog({
        abi: [swapEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Swap") continue;
      const sender = (decoded.args.sender as string).toLowerCase();
      if (sender !== creator) continue;
      const amount0 = decoded.args.amount0 as bigint;
      const amount1 = decoded.args.amount1 as bigint;
      const quoteDelta = tokenIs0 ? amount1 : amount0;
      if (quoteDelta >= BigInt(0)) continue;

      const tokenAmt = tokenIs0 ? abs(amount0) : abs(amount1);
      const quoteAmt = tokenIs0 ? abs(amount1) : abs(amount0);
      const block = log.blockNumber
        ? await client.getBlock({ blockNumber: log.blockNumber })
        : null;
      return {
        completed: true,
        quoteSpent: quoteAmt.toString(),
        tokensReceived: tokenAmt.toString(),
        txHash: log.transactionHash,
        timestamp: block ? Number(block.timestamp) : undefined,
      };
    }
  }

  return { completed: false };
}

export function formatDevBuyQuote(raw: string, quoteDecimals: number, quoteLabel: string) {
  const n = Number(formatUnits(BigInt(raw), quoteDecimals));
  if (quoteLabel === "ETH" || quoteDecimals === 18) {
    return `${n < 1 ? n.toFixed(4) : n.toFixed(3)} ETH`;
  }
  return `${n.toFixed(2)} ${quoteLabel}`;
}

export function formatDevBuyTokens(raw: string, decimals: number, symbol: string) {
  const n = Number(formatUnits(BigInt(raw), decimals));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${symbol}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K ${symbol}`;
  return `${n.toFixed(2)} ${symbol}`;
}

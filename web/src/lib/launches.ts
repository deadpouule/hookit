import type { Address, PublicClient } from "viem";

import { unpackLaunchBitmask } from "@/lib/bitmask";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import type { TokenPool } from "@/lib/types";

const GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  "linear-gradient(135deg, #2d1b69 0%, #11998e 100%)",
  "linear-gradient(135deg, #434343 0%, #000000 100%)",
  "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  "linear-gradient(135deg, #141e30 0%, #243b55 100%)",
];

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function gradientForAddress(address: string): string {
  const n = address.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

export type OnChainLaunch = {
  launchId: bigint;
  token: Address;
  creator: Address;
  hooks: Address;
  customHook: boolean;
  poolId: `0x${string}`;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  name: string;
  symbol: string;
  bitmask: bigint;
};

export function launchToTokenPool(launch: OnChainLaunch): TokenPool {
  const { modules } = unpackLaunchBitmask(launch.bitmask);
  const token = launch.token.toLowerCase();

  return {
    id: token,
    name: launch.name,
    ticker: launch.symbol,
    image: "",
    banner: "",
    marketCap: 0,
    floorValue: 0,
    liquidity: Number(launch.liquidity) / 1e18,
    change24h: 0,
    hooks: {
      antiSnipe: modules.antiSnipe,
      backedFloor: modules.backedFloor,
      antiMev: modules.antiMev,
      customHook: launch.customHook,
    },
    address: shortenAddress(token),
    quoteAsset: "ETH",
    hookType: launch.customHook ? "Custom" : "Master",
    bannerGradient: gradientForAddress(token),
    contractAddress: launch.token,
    poolId: launch.poolId,
    tokenIsCurrency0: false,
    priceEth: 0,
    volume24h: 0,
  };
}

export async function fetchLaunchById(
  publicClient: PublicClient,
  factory: Address,
  launchId: bigint,
): Promise<OnChainLaunch | null> {
  if (launchId === BigInt(0)) return null;

  const launch = (await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launches",
    args: [launchId],
  })) as readonly [
    Address,
    Address,
    Address,
    boolean,
    `0x${string}`,
    number,
    number,
    bigint,
  ];

  const [token, creator, hooks, customHook, poolId, tickLower, tickUpper, liquidity] =
    launch;

  const results = (await publicClient.multicall({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "name" },
      { address: token, abi: erc20Abi, functionName: "symbol" },
      { address: hooks, abi: masterLaunchHookAbi, functionName: "configs", args: [poolId] },
    ],
  })) as { result?: unknown; status: string }[];

  const name = (results[0]?.result as string | undefined) ?? "Unknown";
  const symbol = (results[1]?.result as string | undefined) ?? "???";
  const bitmask = (results[2]?.result as bigint | undefined) ?? BigInt(0);

  return {
    launchId,
    token,
    creator,
    hooks,
    customHook,
    poolId,
    tickLower,
    tickUpper,
    liquidity,
    name,
    symbol,
    bitmask,
  };
}

export async function fetchAllLaunches(
  publicClient: PublicClient,
  factory: Address,
): Promise<OnChainLaunch[]> {
  const count = (await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launchCount",
  })) as bigint;

  const n = Number(count);
  if (n === 0) return [];

  const launches = await Promise.all(
    Array.from({ length: n }, (_, i) => fetchLaunchById(publicClient, factory, BigInt(i + 1))),
  );

  return launches.filter((l): l is OnChainLaunch => l !== null).reverse();
}

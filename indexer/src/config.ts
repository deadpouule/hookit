import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineChain, type Address, type Hex } from "viem";

export const ink = defineChain({
  id: 57_073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"] },
  },
});

export const baseSepolia = defineChain({
  id: 84_532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org"],
    },
  },
});

export type IndexerConfig = {
  chainId: number;
  rpcUrl: string;
  port: number;
  pollMs: number;
  chunkSize: bigint;
  dataDir: string;
  launchFactory?: Address;
  bondingFactory?: Address;
  poolManager: Address;
  startBlock: bigint;
};

function addr(env: string | undefined): Address | undefined {
  const v = env?.trim();
  if (!v || v === "0x") return undefined;
  return v as Address;
}

export function loadConfig(): IndexerConfig {
  const chainKey = (process.env.HOOKIT_CHAIN ?? process.env.NEXT_PUBLIC_HOOKIT_CHAIN ?? "ink").toLowerCase();
  const isInk = chainKey === "ink" || chainKey === "57073";
  const chain = isInk ? ink : baseSepolia;

  const rpcUrl =
    process.env.INDEXER_RPC_URL ??
    (isInk
      ? (process.env.INK_RPC_URL ?? process.env.NEXT_PUBLIC_INK_RPC_URL ?? chain.rpcUrls.default.http[0])
      : (process.env.BASE_SEPOLIA_RPC_URL ??
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
        chain.rpcUrls.default.http[0]));

  const poolManager = (process.env.POOL_MANAGER ??
    (isInk
      ? "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32"
      : "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408")) as Address;

  const defaultData = join(fileURLToPath(new URL("..", import.meta.url)), "data");

  return {
    chainId: chain.id,
    rpcUrl,
    port: Number(process.env.INDEXER_PORT ?? 8787),
    pollMs: Number(process.env.INDEXER_POLL_MS ?? 12_000),
    chunkSize: BigInt(process.env.INDEXER_CHUNK ?? 2_000),
    dataDir: process.env.INDEXER_DATA_DIR ?? defaultData,
    launchFactory: addr(process.env.LAUNCH_FACTORY ?? process.env.NEXT_PUBLIC_LAUNCH_FACTORY),
    bondingFactory: addr(process.env.BONDING_FACTORY ?? process.env.NEXT_PUBLIC_BONDING_FACTORY),
    poolManager,
    startBlock: BigInt(process.env.INDEXER_START_BLOCK ?? "0"),
  };
}

export type TradeSide = "buy" | "sell";

export type IndexedTrade = {
  txHash: Hex;
  blockNumber: number;
  timestamp: number;
  side: TradeSide;
  quoteAmount: string;
  tokenAmount: string;
  price: string;
  sqrtPriceX96: string;
};

export type Candle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  vQuote: string;
  trades: number;
};

export type TokenRow = {
  address: Address;
  poolId: Hex;
  quote: Address;
  tokenIsCurrency0: boolean;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  creator: Address;
  launchedAt: number;
  launchId: number;
  rail: "master" | "classic";
  holders: Record<string, string>;
  trades: IndexedTrade[];
  candles5m: Candle[];
};

export type StoreFile = {
  version: 1;
  chainId: number;
  cursor: string;
  updatedAt: number;
  tokens: Record<string, TokenRow>;
  poolToToken: Record<string, string>;
};

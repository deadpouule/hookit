import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineChain, type Address, type Hex } from "viem";

/** Official Ink public RPCs (Gelato primary, QuickNode secondary). */
export const INK_RPC_DEFAULTS = [
  "https://rpc-gel.inkonchain.com",
  "https://rpc-qnd.inkonchain.com",
] as const;

export const ink = defineChain({
  id: 57_073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [...INK_RPC_DEFAULTS] },
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
  /** Primary RPC (first in `rpcUrls`) — kept for logs / health. */
  rpcUrl: string;
  /** Ordered list — viem `fallback()` tries these in order on failure / stall. */
  rpcUrls: string[];
  port: number;
  pollMs: number;
  chunkSize: bigint;
  confirmations: bigint;
  dataDir: string;
  launchFactory?: Address;
  bondingFactory?: Address;
  poolManager: Address;
  startBlock: bigint;
  excludeAddresses: Set<string>;
};

function addr(env: string | undefined): Address | undefined {
  const v = env?.trim();
  if (!v || v === "0x") return undefined;
  return v as Address;
}

function addrList(env: string | undefined): Address[] {
  if (!env?.trim()) return [];
  return env.split(",").map((s) => s.trim() as Address).filter(Boolean);
}

/** Dedupe while preserving order. */
function uniqUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Resolve RPC URL list.
 * - Comma-separated `INDEXER_RPC_URLS` / `INK_RPC_URLS` wins when set.
 * - Else primary (`INK_RPC_URL` / …) + backup (`INK_RPC_URL_BACKUP` / `INDEXER_RPC_URL_BACKUP`).
 * - Ink defaults: gel → qnd when nothing set.
 */
export function resolveRpcUrls(isInk: boolean): string[] {
  const multi =
    process.env.INDEXER_RPC_URLS?.trim() ||
    process.env.INK_RPC_URLS?.trim() ||
    "";
  if (multi) return uniqUrls(multi.split(","));

  if (isInk) {
    const primary =
      process.env.INK_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_INK_RPC_URL?.trim() ||
      process.env.INDEXER_RPC_URL?.trim() ||
      INK_RPC_DEFAULTS[0];
    const backup =
      process.env.INK_RPC_URL_BACKUP?.trim() ||
      process.env.INDEXER_RPC_URL_BACKUP?.trim() ||
      INK_RPC_DEFAULTS[1];
    return uniqUrls([primary, backup]);
  }

  const primary =
    process.env.BASE_SEPOLIA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim() ||
    process.env.INDEXER_RPC_URL?.trim() ||
    "https://sepolia.base.org";
  const backup = process.env.BASE_SEPOLIA_RPC_URL_BACKUP?.trim();
  return uniqUrls(backup ? [primary, backup] : [primary]);
}

export function loadConfig(): IndexerConfig {
  const chainKey = (process.env.HOOKIT_CHAIN ?? process.env.NEXT_PUBLIC_HOOKIT_CHAIN ?? "ink").toLowerCase();
  const isInk = chainKey === "ink" || chainKey === "57073";

  const rpcUrls = resolveRpcUrls(isInk);
  const rpcUrl = rpcUrls[0]!;

  const poolManager = (process.env.POOL_MANAGER ??
    (isInk
      ? "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32"
      : "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408")) as Address;

  const launchFactory = addr(
    process.env.LAUNCH_FACTORY ??
      process.env.NEXT_PUBLIC_LAUNCH_FACTORY,
  );
  const bondingFactory = addr(
    process.env.BONDING_FACTORY ??
      process.env.NEXT_PUBLIC_BONDING_FACTORY,
  );

  const exclude = new Set<string>([
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
    poolManager.toLowerCase(),
    ...addrList(process.env.INDEXER_EXCLUDE).map((a) => a.toLowerCase()),
  ]);
  if (launchFactory) exclude.add(launchFactory.toLowerCase());
  if (bondingFactory) exclude.add(bondingFactory.toLowerCase());

  const defaultData = join(fileURLToPath(new URL("..", import.meta.url)), "data");

  return {
    chainId: isInk ? ink.id : baseSepolia.id,
    rpcUrl,
    rpcUrls,
    port: Number(process.env.INDEXER_PORT ?? 8787),
    pollMs: Number(process.env.INDEXER_POLL_MS ?? 12_000),
    chunkSize: BigInt(process.env.INDEXER_CHUNK ?? (isInk ? 800 : 2_000)),
    confirmations: BigInt(process.env.INDEXER_CONFIRMATIONS ?? 12),
    dataDir: process.env.INDEXER_DATA_DIR ?? defaultData,
    launchFactory,
    bondingFactory,
    poolManager,
    startBlock: BigInt(process.env.INDEXER_START_BLOCK ?? "0"),
    excludeAddresses: exclude,
  };
}

export type TradeSide = "buy" | "sell";

export type IndexedTrade = {
  id: string;
  txHash: Hex;
  logIndex: number;
  blockNumber: number;
  timestamp: number;
  side: TradeSide;
  quoteAmount: string;
  tokenAmount: string;
  price: string;
  sqrtPriceX96: string;
  actor?: string;
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

export type TokenMarket = {
  poolId: Hex;
  quote: Address;
  bps: number;
  tokenIsCurrency0: boolean;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
};

export type TokenRow = {
  address: Address;
  poolId: Hex;
  quote: Address;
  tokenIsCurrency0: boolean;
  name: string;
  symbol: string;
  decimals: number;
  quoteDecimals: number;
  totalSupply: string;
  creator: Address;
  launchedAt: number;
  launchId: number;
  rail: "master" | "classic";
  metadataURI?: string;
  hookModules?: string;
  bondingPhase?: number;
  tokensSold?: string;
  graduationQuote?: string;
  realQuote?: string;
  graduatedAt?: number;
  /** Present when indexed via `launchMulti` (1–5 canonical pools). */
  marketCount?: number;
  markets?: TokenMarket[];
  holders: Record<string, string>;
  trades: IndexedTrade[];
  candles5m: Candle[];
};

export type StoreFileV1 = {
  version: 1;
  chainId: number;
  cursor: string;
  updatedAt: number;
  tokens: Record<string, TokenRow>;
  poolToToken: Record<string, string>;
};

export type StoreFile = {
  version: 2;
  chainId: number;
  cursor: string;
  updatedAt: number;
  lastPollError?: string;
  lastPollAt?: number;
  tokens: Record<string, TokenRow>;
  poolToToken: Record<string, string>;
  launchIdToToken: Record<string, string>;
  seenTrades: Record<string, true>;
};

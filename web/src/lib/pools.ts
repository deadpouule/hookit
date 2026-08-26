import { MOCK_POOLS } from "./constants";
import { MARKET_TOKENS } from "./market-tokens";
import type { TokenPool } from "./types";

const FULL_ADDRESSES: Record<string, string> = {
  "1": "0x7987a1b2c3d4e5f67890123456789012345624EE",
  "2": "0x3b2C77d209D3405F41a037Ec6c77F7F5b8e2ca80",
  "3": "0x9d4e8f1a2b3c4d5e6f7890abcdef123456789a1f",
  "4": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef0e",
  "5": "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  "6": "0x8B5bcC363ddE2614281aD875bad385E0A785D3B9",
  "7": "0xa1b2c3d4e5f6789012345678901234567890c3d4",
  "8": "0xf00dbeef1234567890abcdef1234567890beef",
  "9": "0xdeadbeef1234567890abcdef1234567890cafe",
};

export function getPoolById(id: string): TokenPool | undefined {
  const pool = MOCK_POOLS.find((p) => p.id === id);
  if (!pool) return undefined;
  if (pool.priceEth !== undefined) return pool;

  const seed = Number(id) || 1;
  return {
    ...pool,
    contractAddress: FULL_ADDRESSES[id] ?? `0x${id.padStart(40, "0")}`,
    priceEth: 1.43e-9 * seed * 0.7,
    volume24h: pool.liquidity * 0.15,
  };
}

export function getAllPoolIds(): string[] {
  return [...MOCK_POOLS.map((p) => p.id), ...MARKET_TOKENS.map((t) => t.id)];
}

export function getDetailPool(id: string): TokenPool | undefined {
  const pool = getPoolById(id);
  if (pool) return pool;
  const token = MARKET_TOKENS.find((item) => item.id === id);
  if (!token) return undefined;
  return {
    id: token.id,
    name: token.name,
    ticker: token.ticker,
    image: token.emoji,
    banner: "",
    bannerGradient: token.art,
    marketCap: token.marketCap,
    floorValue: token.marketCap * 0.08,
    liquidity: token.marketCap * 0.4,
    change24h: token.change24h,
    hooks: {
      antiSnipe: true,
      backedFloor: token.kind === "pool",
      antiMev: true,
      customHook: token.kind === "sushi",
    },
    address: `${token.creator.slice(0, 6)}...${token.creator.slice(-4)}`,
    contractAddress: token.creator,
    hookType: token.kind === "sushi" ? "Custom" : "Master",
    volume24h: token.volume,
  };
}


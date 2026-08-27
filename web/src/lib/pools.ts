import { MOCK_POOLS } from "./constants";
import { MARKET_TOKENS } from "./market-tokens";
import type { TokenPool } from "./types";

export type ChartTimeframe = "1H" | "1D" | "1W" | "ALL";

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

/** Deterministic pseudo-random chart series for mock UI. */
export function generateChartSeries(
  poolId: string,
  timeframe: ChartTimeframe,
  length = 48,
): number[] {
  const counts: Record<ChartTimeframe, number> = {
    "1H": 24,
    "1D": 48,
    "1W": 56,
    ALL: 72,
  };
  const n = counts[timeframe];
  let seed = poolId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = getPoolById(poolId)?.priceEth ?? 1e-9;

  const points: number[] = [];
  let v = base * (1 + (seed % 7) * 0.05);

  for (let i = 0; i < n; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    const noise = ((seed % 1000) / 1000 - 0.5) * base * 0.08;
    const wave = Math.sin((i / n) * Math.PI * 2) * base * 0.25;
    v = Math.max(base * 0.3, v + noise + wave * 0.02);
    points.push(v);
  }

  // End near current price
  points[points.length - 1] = base;
  return points;
}

export function formatPriceEth(price: number): string {
  if (price === 0) return "0 ETH";
  if (price < 1e-6) return `${price.toExponential(5)} ETH`;
  if (price < 0.001) return `${price.toFixed(8)} ETH`;
  return `${price.toFixed(6)} ETH`;
}

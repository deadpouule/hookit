export type MarketKind = "pool" | "sushi";

export interface MarketToken {
  id: string;
  name: string;
  ticker: string;
  description: string;
  emoji: string;
  art: string;
  artAccent: string;
  marketCap: number;
  volume: number;
  change1h: number;
  change24h: number;
  creator: string;
  kind: MarketKind;
  launchedAt: number;
  /** Classic bonding % toward graduation (0–100). Undefined for master / demo. */
  bondPct?: number;
  rail?: "master" | "classic";
  bondingPhase?: number;
  hookType?: "Master" | "Custom" | "Classic";
  quoteAsset?: string;
  quoteAddress?: string;
  isRwa?: boolean;
  /** First launch of this ticker when duplicates exist — gets the OG badge. */
  isOriginal?: boolean;
  /** Later launch reusing the same ticker — gets the COPY flag. */
  isCopycat?: boolean;
  /** Enabled master hook modules (on-chain pools only). */
  masterHookIds?: import("@/lib/master-hooks").MasterHookId[];
  /** Canonical quote pools when launched via `launchMulti`. */
  marketCount?: number;
  markets?: import("@/lib/types").TokenPoolMarket[];
  pairings?: import("@/lib/pairing-badge").PairingBadgeInfo[];
}

export const QUICK_BUY_AMOUNTS = [10, 25, 50, 100] as const;

/** Market cap at which a new pair is treated as bonded / graduated. */
export const BOND_GRADUATE_USD = 1_000_000;

const T0 = 1_724_536_800_000;
export const MARKET_NOW = T0;

/** Demo catalog with hookType/rail filled in for marketplace badges. */
export function buildDemoMarketTokens(): MarketToken[] {
  return MARKET_TOKENS.map((t) => ({
    ...t,
    hookType: t.hookType ?? (t.kind === "sushi" ? ("Custom" as const) : ("Master" as const)),
    rail: t.rail ?? ("master" as const),
  }));
}

export const MARKET_TOKENS: MarketToken[] = [
  {
    id: "smingo-copy",
    name: "Sushi Mingo",
    ticker: "SMINGO",
    description: "copycat launch — same name, different contract",
    emoji: "🦩",
    art: "linear-gradient(160deg, #52525b 0%, #3f3f46 40%, #27272a 100%)",
    artAccent: "#a1a1aa",
    marketCap: 42_000,
    volume: 3_200,
    change1h: -8.2,
    change24h: -12.1,
    creator: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    kind: "sushi",
    launchedAt: T0 - 1000 * 60 * 5,
    hookType: "Custom",
    rail: "master",
  },
  {
    id: "marscoin",
    name: "MarsCoin",
    ticker: "MARS",
    description: "classic bonding curve on ETH",
    emoji: "🔴",
    art: "linear-gradient(160deg, #7f1d1d 0%, #dc2626 40%, #450a0a 100%)",
    artAccent: "#fca5a5",
    marketCap: 88_000,
    volume: 12_400,
    change1h: 2.1,
    change24h: 5.3,
    creator: "0x7bE21a9c04d84e117b217b21c7bE21a9c04d7b22",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 34 * 24,
    hookType: "Classic",
    rail: "classic",
    bondingPhase: 0,
    bondPct: 78,
  },
  {
    id: "aapl-rwa",
    name: "Apple Yield",
    ticker: "APYLD",
    description: "master launch paired against wAAPLx",
    emoji: "🍎",
    art: "linear-gradient(145deg, #1c1917 0%, #dc2626 50%, #1c1917 100%)",
    artAccent: "#fca5a5",
    marketCap: 560_000,
    volume: 45_000,
    change1h: 1.2,
    change24h: 3.8,
    creator: "0xabcabcabcabcabcabcabcabcabcabcabcabcabcc",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 120,
    hookType: "Master",
    rail: "master",
    quoteAsset: "wAAPLx",
    isRwa: true,
  },
  {
    id: "smingo",
    name: "Sushi Mingo",
    ticker: "SMINGO",
    description: "flamingo sushi pair, quote-only fees on every swap",
    emoji: "🦩",
    art: "linear-gradient(160deg, #fb7185 0%, #f43f5e 40%, #7c3aed 100%)",
    artAccent: "#fda4af",
    marketCap: 1_240_000,
    volume: 88_100,
    change1h: 12.4,
    change24h: 18.2,
    creator: "0x7bE21a9c04d84e117b217b21c7bE21a9c04d7b21",
    kind: "sushi",
    launchedAt: T0 - 1000 * 60 * 12,
  },
  {
    id: "sushicat",
    name: "Sushi Cat",
    ticker: "SUSHICAT",
    description: "cat coin with anti-snipe decay on opening buys",
    emoji: "🐱",
    art: "linear-gradient(145deg, #fdba74 0%, #fb7185 45%, #38bdf8 100%)",
    artAccent: "#ffedd5",
    marketCap: 2_180_000,
    volume: 312_400,
    change1h: 8.1,
    change24h: 24.6,
    creator: "0x57831af013af013af013af013af013af013af13af",
    kind: "sushi",
    launchedAt: T0 - 1000 * 60 * 40,
  },
  {
    id: "void",
    name: "Void Runner",
    ticker: "VOID",
    description: "void runner with max wallet and MEV guard",
    emoji: "👾",
    art: "linear-gradient(135deg, #1a0533 0%, #6d28d9 50%, #c026d3 100%)",
    artAccent: "#e9d5ff",
    marketCap: 680_000,
    volume: 54_200,
    change1h: -2.4,
    change24h: -8.4,
    creator: "0x9d4e3a1f9d4e3a1f9d4e3a1f9d4e3a1f9d4e3a1f",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 90,
  },
  {
    id: "spark",
    name: "Base Spark",
    ticker: "SPARK",
    description: "base spark on the classic eth curve",
    emoji: "⚡",
    art: "linear-gradient(135deg, #001a66 0%, #0052ff 55%, #d4ff00 100%)",
    artAccent: "#d4ff00",
    marketCap: 3_800_000,
    volume: 1_020_000,
    change1h: 21.3,
    change24h: 56.1,
    creator: "0x1a2b9f0e1a2b9f0e1a2b9f0e1a2b9f0e1a2b9f0e",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 180,
  },
  {
    id: "lean",
    name: "Purple Lean",
    ticker: "LEAN",
    description: "purple lean, backed floor ratchet in quote",
    emoji: "🥤",
    art: "linear-gradient(150deg, #4c1d95 0%, #db2777 50%, #a21caf 100%)",
    artAccent: "#f0abfc",
    marketCap: 940_000,
    volume: 121_000,
    change1h: 6.8,
    change24h: 14.1,
    creator: "0xdeadcafebeefdeadcafebeefdeadcafebeefcafe",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 25,
  },
  {
    id: "nigiri",
    name: "Nigiri Dog",
    ticker: "NIGIRI",
    description: "nigiri dog, 1% auto-burn on token out",
    emoji: "🍣",
    art: "linear-gradient(160deg, #fecaca 0%, #fb7185 40%, #f97316 100%)",
    artAccent: "#fff7ed",
    marketCap: 412_000,
    volume: 39_800,
    change1h: 3.2,
    change24h: 9.4,
    creator: "0xa11ce0a11ce0a11ce0a11ce0a11ce0a11ce0a11c",
    kind: "sushi",
    launchedAt: T0 - 1000 * 60 * 8,
  },
  {
    id: "floor",
    name: "Floor Ratchet",
    ticker: "RATCH",
    description: "ratcheting floor vault, never decreases",
    emoji: "🛡️",
    art: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #d4ff00 100%)",
    artAccent: "#d4ff00",
    marketCap: 1_450_000,
    volume: 198_000,
    change1h: 4.1,
    change24h: 8.9,
    creator: "0x3b2c8e2c3b2c8e2c3b2c8e2c3b2c8e2c3b2c8e2c",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 240,
  },
  {
    id: "froggo",
    name: "Froggo",
    ticker: "FROG",
    description: "froggo lp donate, 0.25% to in-range LPs",
    emoji: "🐸",
    art: "linear-gradient(145deg, #166534 0%, #22c55e 45%, #bef264 100%)",
    artAccent: "#d9f99d",
    marketCap: 276_000,
    volume: 22_400,
    change1h: -1.1,
    change24h: 2.8,
    creator: "0x8b5bd3b98b5bd3b98b5bd3b98b5bd3b98b5bd3b9",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 55,
  },
  {
    id: "ice",
    name: "Ice Cube",
    ticker: "ICE",
    description: "ice cube max tx cap vs circulating supply",
    emoji: "🧊",
    art: "linear-gradient(160deg, #0ea5e9 0%, #38bdf8 40%, #e0f2fe 100%)",
    artAccent: "#f0f9ff",
    marketCap: 188_000,
    volume: 14_900,
    change1h: 1.6,
    change24h: -3.2,
    creator: "0x5e7334085e7334085e7334085e7334085e733408",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 70,
  },
  {
    id: "mev",
    name: "MEV Ghost",
    ticker: "GHOST",
    description: "same-block opposing swap cooldown",
    emoji: "👻",
    art: "linear-gradient(135deg, #111827 0%, #4c1d95 55%, #e9d5ff 100%)",
    artAccent: "#ddd6fe",
    marketCap: 524_000,
    volume: 67_300,
    change1h: 15.7,
    change24h: 11.2,
    creator: "0xf00dbeef0dbeef0dbeef0dbeef0dbeef0dbeef00",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 18,
  },
  {
    id: "onigiri",
    name: "Onigiri",
    ticker: "ONI",
    description: "onigiri buyback vest, 5-year linear unlock",
    emoji: "🍙",
    art: "linear-gradient(150deg, #fafafa 0%, #a3e635 40%, #166534 100%)",
    artAccent: "#ecfccb",
    marketCap: 96_400,
    volume: 8_200,
    change1h: 0.8,
    change24h: 4.5,
    creator: "0xc0ffee00c0ffee00c0ffee00c0ffee00c0ffee00",
    kind: "sushi",
    launchedAt: T0 - 1000 * 60 * 6,
  },
  {
    id: "hook",
    name: "Liquid Hook",
    ticker: "HOOK",
    description: "liquid hook, quote-only swap fee split",
    emoji: "🪝",
    art: "linear-gradient(145deg, #0c4a6e 0%, #38bdf8 50%, #0052ff 100%)",
    artAccent: "#7dd3fc",
    marketCap: 920_000,
    volume: 78_500,
    change1h: 2.2,
    change24h: 4.2,
    creator: "0x798724ee798724ee798724ee798724ee798724ee",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 300,
  },
  {
    id: "pepper",
    name: "Meme Lord",
    ticker: "LORD",
    description: "meme lord with dynamic fees on flow",
    emoji: "😈",
    art: "linear-gradient(135deg, #450a0a 0%, #dc2626 50%, #fbbf24 100%)",
    artAccent: "#fecaca",
    marketCap: 890_000,
    volume: 64_800,
    change1h: -4.6,
    change24h: -3.2,
    creator: "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdead",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 210,
  },
  {
    id: "moon",
    name: "Moon Soup",
    ticker: "SOUP",
    description: "moon soup, anti-snipe then classic curve",
    emoji: "🌙",
    art: "linear-gradient(160deg, #1e1b4b 0%, #6366f1 45%, #fde68a 100%)",
    artAccent: "#c7d2fe",
    marketCap: 334_000,
    volume: 29_100,
    change1h: 9.9,
    change24h: 16.0,
    creator: "0x1111222233334444555566667777888899990000",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 33,
  },
  {
    id: "robo",
    name: "Chrome Bot",
    ticker: "BOT",
    description: "chrome bot, max wallet after every buy",
    emoji: "🤖",
    art: "linear-gradient(145deg, #27272a 0%, #71717a 40%, #e4e4e7 100%)",
    artAccent: "#f4f4f5",
    marketCap: 1_020_000,
    volume: 141_000,
    change1h: 5.4,
    change24h: 7.7,
    creator: "0xabcabcabcabcabcabcabcabcabcabcabcabcabca",
    kind: "pool",
    launchedAt: T0 - 1000 * 60 * 150,
  },
];

export function truncateCreator(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Contract address used for copy-to-clipboard on market cards. */
export function resolveTokenContractAddress(token: MarketToken): string {
  if (ETH_ADDRESS.test(token.id)) return token.id;
  if (ETH_ADDRESS.test(token.creator)) return token.creator;
  return token.creator;
}

import { isRwaQuote } from "@/lib/token-identity";
import { masterHookIdsForPool } from "@/lib/master-hooks";
import { pairingBadgesForPool } from "@/lib/pairing-badge";

/** Map on-chain TokenPool → market card model. */
export function poolToMarketToken(pool: import("@/lib/types").TokenPool): MarketToken {
  const art = pool.bannerGradient || "linear-gradient(135deg, #1a0533 0%, #6d28d9 50%, #c026d3 100%)";
  let bondPct: number | undefined;
  if (pool.rail === "classic") {
    if (pool.bondingPhase !== 0) {
      bondPct = 100;
    } else {
      const real = BigInt(pool.realQuote ?? "0");
      const goal = BigInt(pool.graduationQuote ?? "0");
      bondPct =
        goal === BigInt(0) ? 0 : Math.min(99, Math.round(Number((real * BigInt(100)) / goal)));
    }
  }
  return {
    id: pool.contractAddress ?? pool.id,
    name: pool.name,
    ticker: pool.ticker,
    description:
      pool.rail === "classic"
        ? pool.bondingPhase === 0
          ? "Classic bonding curve — graduating at 4.2 ETH-equiv"
          : "Classic graduated pool"
        : pool.hookType === "Custom"
          ? "Custom Uniswap v4 hook"
          : "Master launch with modules",
    emoji: pool.image || pool.ticker.slice(0, 1).toUpperCase(),
    art,
    artAccent: "#e9d5ff",
    marketCap: pool.marketCap || 4_000,
    volume: pool.volume24h ?? 0,
    change1h: pool.change24h * 0.25,
    change24h: pool.change24h,
    creator: pool.creator ?? pool.address,
    kind: pool.hookType === "Custom" ? "sushi" : "pool",
    launchedAt: (() => {
      const ts = (pool.launchedAt ?? Date.now() / 1000) * 1000;
      // pool.launchedAt is unix seconds when valid; market cards use ms.
      if (pool.launchedAt && pool.launchedAt > 1_000_000_000) return pool.launchedAt * 1000;
      return Date.now();
    })(),
    bondPct,
    rail: pool.rail,
    bondingPhase: pool.bondingPhase,
    hookType: pool.hookType,
    quoteAsset: pool.quoteAsset,
    quoteAddress: pool.quoteAddress,
    isRwa:
      isRwaQuote(pool.quoteAsset, pool.quoteAddress) ||
      Boolean(pool.markets?.some((market) => isRwaQuote(market.quoteAsset, market.quoteAddress))),
    masterHookIds: masterHookIdsForPool(pool),
    marketCount: pool.marketCount,
    markets: pool.markets,
    pairings: pairingBadgesForPool(pool),
  };
}

export function isBonded(token: MarketToken) {
  if (token.bondPct != null) return token.bondPct >= 100;
  return token.marketCap >= BOND_GRADUATE_USD;
}

export function bondProgress(token: MarketToken) {
  if (token.bondPct != null) return Math.max(0, Math.min(100, token.bondPct));
  if (isBonded(token)) return 100;
  return Math.max(0, Math.min(99, Math.round((token.marketCap / BOND_GRADUATE_USD) * 100)));
}

export function tokenAgeLabel(launchedAt: number, now = MARKET_NOW) {
  const seconds = Math.max(1, Math.floor((now - launchedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function leaders(tokens = MARKET_TOKENS, count = 3) {
  return [...tokens].sort((a, b) => b.marketCap - a.marketCap).slice(0, count);
}

export function trending(tokens = MARKET_TOKENS, count = 8) {
  return [...tokens].sort((a, b) => b.change1h - a.change1h).slice(0, count);
}

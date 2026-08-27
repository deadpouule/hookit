import type { TokenPool } from "@/lib/types";

export const MAX_SWAPS = 18;
export const CANDLE_BUFFER = 96;
export const TOTAL_SUPPLY = 1_000_000_000;
export const LIVE_TICK_MS = 3_000;

export type SwapSide = "buy" | "sell";

export interface LiveSwap {
  id: string;
  ageSec: number;
  recipient: string;
  side: SwapSide;
  amount: number;
  totalUsd: number;
  marketCap: number;
}

export interface LiveHolder {
  address: string;
  pct: number;
  balance: number;
}

export interface LiveCandle {
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface LiveTokenState {
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  txns: number;
  change5m: number;
  change1h: number;
  change6h: number;
  change24h: number;
  buyPct: number;
  candles: LiveCandle[];
  swaps: LiveSwap[];
  holderRows: LiveHolder[];
}

function hashId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wallet(rng: () => number) {
  const hex = Array.from({ length: 40 }, () =>
    Math.floor(rng() * 16).toString(16),
  ).join("");
  return `0x${hex}`;
}

function truncateAddr(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function nextCandle(prev: LiveCandle, nextClose: number, rng: () => number): LiveCandle {
  const o = prev.c;
  const c = nextClose;
  const wick = Math.abs(c - o) * (0.35 + rng() * 1.4) + nextClose * 0.0015;
  return {
    o,
    c,
    h: Math.max(o, c) + wick * rng(),
    l: Math.max(1, Math.min(o, c) - wick * rng()),
  };
}

export function buildInitialLive(pool: TokenPool): LiveTokenState {
  const rng = mulberry32(hashId(pool.id));
  const marketCap = Math.max(pool.marketCap, 1_000);
  const priceUsd = marketCap / TOTAL_SUPPLY;
  const volume24h = pool.volume24h ?? pool.liquidity * 0.18;
  const liquidity = pool.liquidity || marketCap * 0.35;

  const candles: LiveCandle[] = [];
  let price = marketCap;
  let open = price * (0.92 + rng() * 0.08);
  for (let i = 0; i < CANDLE_BUFFER; i += 1) {
    const step = (rng() * 2 - 1) * 0.018;
    const close = Math.max(price * (1 + step), marketCap * 0.55);
    const wick = Math.abs(close - open) * (0.4 + rng()) + price * 0.002;
    candles.push({
      o: open,
      c: close,
      h: Math.max(open, close) + wick * rng(),
      l: Math.max(1, Math.min(open, close) - wick * rng()),
    });
    open = close;
    price = close;
  }
  candles[candles.length - 1].c = marketCap;
  candles[candles.length - 1].h = Math.max(candles[candles.length - 1].h, marketCap);
  candles[candles.length - 1].l = Math.min(candles[candles.length - 1].l, marketCap);

  const swaps: LiveSwap[] = [];
  let capCursor = marketCap;
  for (let i = 0; i < MAX_SWAPS; i += 1) {
    const side: SwapSide = rng() > 0.46 ? "buy" : "sell";
    const totalUsd = 12 + rng() * 4200;
    const delta = (side === "buy" ? 1 : -1) * (0.0004 + rng() * 0.004);
    capCursor = Math.max(capCursor * (1 - delta), marketCap * 0.7);
    swaps.push({
      id: `init-${i}`,
      ageSec: Math.floor(3 + rng() * 900),
      recipient: truncateAddr(wallet(rng)),
      side,
      amount: totalUsd / priceUsd,
      totalUsd,
      marketCap: capCursor,
    });
  }
  swaps.sort((a, b) => a.ageSec - b.ageSec);

  const buys = swaps.filter((s) => s.side === "buy").length;
  const holderCount = 40 + Math.floor(rng() * 180);
  const holderRows: LiveHolder[] = [];
  let remaining = 62;
  for (let i = 0; i < 12; i += 1) {
    const pct = i === 0 ? 8 + rng() * 10 : Math.max(0.4, remaining * (0.08 + rng() * 0.18));
    remaining -= pct;
    const address = i === 0 ? pool.contractAddress ?? pool.address : wallet(rng);
    holderRows.push({
      address: truncateAddr(address),
      pct,
      balance: (pct / 100) * TOTAL_SUPPLY,
    });
  }

  const signed = (base: number) => clamp(base + (rng() * 8 - 4), -28, 42);

  return {
    priceUsd,
    marketCap,
    volume24h,
    liquidity,
    holders: holderCount,
    txns: 400 + Math.floor(rng() * 1800),
    change5m: signed(pool.change24h * 0.08),
    change1h: signed(pool.change24h * 0.22),
    change6h: signed(pool.change24h * 0.55),
    change24h: pool.change24h,
    buyPct: (buys / swaps.length) * 100,
    candles,
    swaps,
    holderRows,
  };
}

export function tickLive(prev: LiveTokenState): LiveTokenState {
  const delta = Math.random() * 0.02 - 0.01;
  const marketCap = Math.max(prev.marketCap * (1 + delta), 500);
  const priceUsd = marketCap / TOTAL_SUPPLY;
  const side: SwapSide = Math.random() > 0.47 ? "buy" : "sell";
  const totalUsd = 18 + Math.random() * 3800;
  const swap: LiveSwap = {
    id: `live-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    ageSec: 0,
    recipient: truncateAddr(wallet(Math.random)),
    side,
    amount: totalUsd / priceUsd,
    totalUsd,
    marketCap,
  };

  const last = prev.candles[prev.candles.length - 1];
  const candles = prev.candles.slice();
  if (Math.random() > 0.55) {
    candles.push(nextCandle(last, marketCap, Math.random));
    if (candles.length > CANDLE_BUFFER) candles.shift();
  } else {
    const updated = { ...last, c: marketCap };
    updated.h = Math.max(updated.h, marketCap);
    updated.l = Math.min(updated.l, marketCap);
    candles[candles.length - 1] = updated;
  }

  const swaps = [swap, ...prev.swaps.map((row) => ({ ...row, ageSec: row.ageSec + 3 }))].slice(
    0,
    MAX_SWAPS,
  );
  const buys = swaps.filter((s) => s.side === "buy").length;

  return {
    ...prev,
    priceUsd,
    marketCap,
    volume24h: prev.volume24h + totalUsd * 0.35,
    liquidity: Math.max(prev.liquidity * (1 + delta * 0.35), 200),
    holders: Math.max(8, prev.holders + (Math.random() > 0.82 ? (side === "buy" ? 1 : -1) : 0)),
    txns: prev.txns + 1,
    change5m: clamp(prev.change5m + delta * 40, -35, 45),
    change1h: clamp(prev.change1h + delta * 18, -35, 45),
    change6h: clamp(prev.change6h + delta * 8, -35, 45),
    change24h: clamp(prev.change24h + delta * 4, -40, 80),
    buyPct: (buys / swaps.length) * 100,
    candles,
    swaps,
  };
}

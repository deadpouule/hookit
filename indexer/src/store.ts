import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";

import type { Candle, IndexedTrade, StoreFile, StoreFileV1, TokenMarket, TokenRow } from "./config.js";
import { compareDec, maxDec, minDec, quotePerTokenFromAmounts } from "./math.js";

const INK_USDG = "0xe343167631d89b6ffc58b88d6b7fb0228795491d";

export const MAX_TRADES = 2_000;
export const MAX_CANDLES = 5_000;
export const MAX_SEEN_TRADES = 100_000;
const CANDLE_SEC = 300;
const SEC_24H = 86_400;

export type ActivityWindowStats = {
  txns: number;
  volumeQuote: string;
  buyCount: number;
  sellCount: number;
  buyVolumeQuote: string;
  sellVolumeQuote: string;
  buyPct: number;
};

export const ACTIVITY_WINDOWS = {
  "5m": 300,
  "1h": 3600,
  "6h": 21_600,
  "24h": SEC_24H,
} as const;

export type ActivityWindowKey = keyof typeof ACTIVITY_WINDOWS;

export function defaultDataDir(): string {
  return join(fileURLToPath(new URL("..", import.meta.url)), "data");
}

function quoteDecimalsForTrade(row: TokenRow, poolId?: string): number {
  if (poolId && row.markets?.length) {
    const market = row.markets.find((m) => m.poolId.toLowerCase() === poolId.toLowerCase());
    if (market?.quoteDecimals) return market.quoteDecimals;
    if (market?.quote.toLowerCase() === INK_USDG) return 6;
  }
  return row.quoteDecimals || 18;
}

function rebuildCandles(trades: IndexedTrade[]): Candle[] {
  const series: Candle[] = [];
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  for (const trade of sorted) {
    const bucket = Math.floor(trade.timestamp / CANDLE_SEC) * CANDLE_SEC;
    const last = series[series.length - 1];
    if (!last || last.t !== bucket) {
      series.push({
        t: bucket,
        o: trade.price,
        h: trade.price,
        l: trade.price,
        c: trade.price,
        vQuote: trade.quoteAmount,
        trades: 1,
      });
    } else {
      last.h = maxDec(last.h, trade.price);
      last.l = minDec(last.l, trade.price);
      last.c = trade.price;
      last.vQuote = (BigInt(last.vQuote) + BigInt(trade.quoteAmount)).toString();
      last.trades += 1;
    }
  }
  return series;
}

function repairTradePrices(data: StoreFile): StoreFile {
  for (const row of Object.values(data.tokens)) {
    for (const trade of row.trades) {
      if (!trade.quoteAmount || !trade.tokenAmount) continue;
      trade.price = quotePerTokenFromAmounts(
        BigInt(trade.quoteAmount),
        BigInt(trade.tokenAmount),
        row.decimals,
        quoteDecimalsForTrade(row, trade.poolId),
      );
    }
    row.candles5m = rebuildCandles(
      row.trades.filter(
        (t) => !t.poolId || t.poolId.toLowerCase() === row.poolId.toLowerCase(),
      ),
    );
    if (row.markets?.length) {
      row.candles5mByPool = {};
      for (const market of row.markets) {
        const poolId = market.poolId.toLowerCase();
        row.candles5mByPool[poolId] = rebuildCandles(
          row.trades.filter((t) => t.poolId?.toLowerCase() === poolId),
        );
      }
    }
  }
  return data;
}

export function emptyStore(chainId: number): StoreFile {
  return {
    version: 3,
    chainId,
    cursor: "0",
    updatedAt: 0,
    tokens: {},
    poolToToken: {},
    launchIdToToken: {},
    seenTrades: {},
  };
}

function migrateV1(raw: StoreFileV1): StoreFile {
  const next = emptyStore(raw.chainId);
  next.cursor = raw.cursor;
  next.updatedAt = raw.updatedAt;
  next.tokens = raw.tokens;
  next.poolToToken = raw.poolToToken;
  for (const row of Object.values(raw.tokens)) {
    next.launchIdToToken[String(row.launchId)] = row.address.toLowerCase();
    if (!row.quoteDecimals) row.quoteDecimals = 18;
  }
  return next;
}

export class Store {
  readonly path: string;
  data: StoreFile;
  private readonly exclude: Set<string>;

  constructor(dataDir: string, chainId: number, excludeAddresses?: Set<string>) {
    mkdirSync(dataDir, { recursive: true });
    this.path = join(dataDir, `hookit-${chainId}.json`);
    this.exclude = excludeAddresses ?? new Set();
    if (existsSync(this.path)) {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as StoreFile | StoreFileV1;
      if (raw.version === 2 || raw.version === 3) {
        if (raw.chainId !== chainId) {
          throw new Error(`store chainId ${raw.chainId} != config ${chainId}`);
        }
        this.data = raw.version === 3 ? raw : repairTradePrices(raw);
        if (raw.version === 2) {
          this.data.version = 3;
          this.save();
        }
      } else {
        this.data = migrateV1(raw);
        this.data = repairTradePrices(this.data);
        this.data.version = 3;
        this.save();
      }
    } else {
      this.data = emptyStore(chainId);
    }
  }

  save() {
    this.data.updatedAt = Math.floor(Date.now() / 1000);
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.path);
  }

  setPollError(message: string | undefined) {
    this.data.lastPollAt = Math.floor(Date.now() / 1000);
    if (message) this.data.lastPollError = message;
    else delete this.data.lastPollError;
  }

  getToken(address: string): TokenRow | undefined {
    return this.data.tokens[address.toLowerCase()];
  }

  upsertToken(row: TokenRow) {
    const key = row.address.toLowerCase();
    const existing = this.data.tokens[key];
    if (existing) {
      const incomingPlaceholder =
        !row.name?.trim() ||
        row.name.trim().toLowerCase() === "unknown" ||
        !row.symbol?.trim() ||
        row.symbol.trim() === "???" ||
        row.symbol.trim() === "?";
      const existingOk =
        existing.name?.trim() &&
        existing.name.trim().toLowerCase() !== "unknown" &&
        existing.symbol?.trim() &&
        existing.symbol.trim() !== "???" &&
        existing.symbol.trim() !== "?";
      if (incomingPlaceholder && existingOk) {
        row = { ...row, name: existing.name, symbol: existing.symbol };
      }
    }
    this.data.tokens[key] = row;
    if (row.poolId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      this.data.poolToToken[row.poolId.toLowerCase()] = key;
    }
    if (row.markets?.length) {
      for (const m of row.markets) {
        this.data.poolToToken[m.poolId.toLowerCase()] = key;
      }
    }
    if (row.factory) {
      this.data.launchIdToToken[`${row.factory.toLowerCase()}:${row.launchId}`] = key;
      if (!this.data.launchIdToToken[String(row.launchId)]) {
        this.data.launchIdToToken[String(row.launchId)] = key;
      }
    } else {
      this.data.launchIdToToken[String(row.launchId)] = key;
    }
  }

  registerMarket(token: Address, market: TokenMarket, marketCount?: number) {
    const row = this.getToken(token);
    if (!row) return;
    if (!row.markets) row.markets = [];
    const pid = market.poolId.toLowerCase();
    const ix = row.markets.findIndex((m) => m.poolId.toLowerCase() === pid);
    if (ix >= 0) row.markets[ix] = market;
    else row.markets.push(market);
    row.markets.sort((a, b) => b.bps - a.bps);
    this.data.poolToToken[pid] = token.toLowerCase();
    if (marketCount !== undefined) row.marketCount = marketCount;
  }

  tokenForLaunchId(launchId: bigint | number, factory?: Address): TokenRow | undefined {
    if (factory) {
      const namespaced = this.data.launchIdToToken[`${factory.toLowerCase()}:${launchId}`];
      if (namespaced) return this.data.tokens[namespaced];
    }
    const key = this.data.launchIdToToken[String(launchId)];
    return key ? this.data.tokens[key] : undefined;
  }

  tokenForPool(poolId: Hex | string): TokenRow | undefined {
    const key = this.data.poolToToken[poolId.toLowerCase()];
    return key ? this.data.tokens[key] : undefined;
  }

  isExcluded(address: string): boolean {
    return this.exclude.has(address.toLowerCase());
  }

  seedSupplyHolder(token: Address, holder: Address, amount: bigint) {
    const row = this.getToken(token);
    if (!row || amount <= 0n) return;
    const h = holder.toLowerCase();
    if (this.isExcluded(h)) return;
    row.holders[h] = amount.toString();
  }

  applyTransfer(token: Address, from: Address, to: Address, value: bigint) {
    const row = this.getToken(token);
    if (!row) return;
    const f = from.toLowerCase();
    const t = to.toLowerCase();
    if (f !== "0x0000000000000000000000000000000000000000" && !this.isExcluded(f)) {
      const next = BigInt(row.holders[f] ?? "0") - value;
      if (next <= 0n) delete row.holders[f];
      else row.holders[f] = next.toString();
    }
    if (t !== "0x0000000000000000000000000000000000000000" && !this.isExcluded(t)) {
      row.holders[t] = (BigInt(row.holders[t] ?? "0") + value).toString();
    }
  }

  hasTrade(id: string): boolean {
    return this.data.seenTrades[id] === true;
  }

  pushTrade(token: Address, trade: IndexedTrade): boolean {
    if (this.hasTrade(trade.id)) return false;
    this.data.seenTrades[trade.id] = true;
    const seenKeys = Object.keys(this.data.seenTrades);
    if (seenKeys.length > MAX_SEEN_TRADES) {
      for (const k of seenKeys.slice(0, seenKeys.length - MAX_SEEN_TRADES)) {
        delete this.data.seenTrades[k];
      }
    }

    const row = this.getToken(token);
    if (!row) return false;
    row.trades.push(trade);
    if (row.trades.length > MAX_TRADES) {
      row.trades = row.trades.slice(-MAX_TRADES);
    }
    const poolKey = trade.poolId?.toLowerCase();
    const isPrimary = !poolKey || poolKey === row.poolId.toLowerCase();
    if (isPrimary) this._updateCandleSeries(row.candles5m, trade);
    if (poolKey) {
      if (!row.candles5mByPool) row.candles5mByPool = {};
      if (!row.candles5mByPool[poolKey]) row.candles5mByPool[poolKey] = [];
      this._updateCandleSeries(row.candles5mByPool[poolKey]!, trade);
    }
    return true;
  }

  private _updateCandleSeries(series: Candle[], trade: IndexedTrade) {
    const bucket = Math.floor(trade.timestamp / CANDLE_SEC) * CANDLE_SEC;
    const last = series[series.length - 1];
    if (!last || last.t !== bucket) {
      series.push({
        t: bucket,
        o: trade.price,
        h: trade.price,
        l: trade.price,
        c: trade.price,
        vQuote: trade.quoteAmount,
        trades: 1,
      });
    } else {
      last.h = maxDec(last.h, trade.price);
      last.l = minDec(last.l, trade.price);
      last.c = trade.price;
      last.vQuote = (BigInt(last.vQuote) + BigInt(trade.quoteAmount)).toString();
      last.trades += 1;
    }
    if (series.length > MAX_CANDLES) {
      series.splice(0, series.length - MAX_CANDLES);
    }
  }

  stats24h(token: Address) {
    const stats = this.statsForWindow(token, SEC_24H);
    return {
      volume24h: stats.volumeQuote,
      trades24h: stats.txns,
      change24h: stats.change,
    };
  }

  statsForWindow(token: Address, windowSec: number) {
    const row = this.getToken(token);
    if (!row) {
      return {
        txns: 0,
        volumeQuote: "0",
        change: null as number | null,
      };
    }
    const cutoff = Math.floor(Date.now() / 1000) - windowSec;
    let volume = 0n;
    let txns = 0;
    const recent: IndexedTrade[] = [];
    for (const t of row.trades) {
      if (t.timestamp >= cutoff) {
        volume += BigInt(t.quoteAmount);
        txns += 1;
        recent.push(t);
      }
    }
    let change: number | null = null;
    if (recent.length >= 2) {
      const first = Number(recent[0]!.price);
      const last = Number(recent[recent.length - 1]!.price);
      if (first > 0) change = ((last - first) / first) * 100;
    }
    return { txns, volumeQuote: volume.toString(), change };
  }

  activityStats24h(token: Address) {
    return this.activityStatsForWindow(token, SEC_24H);
  }

  activityStatsForWindow(token: Address, windowSec: number): ActivityWindowStats {
    const row = this.getToken(token);
    if (!row) {
      return {
        txns: 0,
        volumeQuote: "0",
        buyCount: 0,
        sellCount: 0,
        buyVolumeQuote: "0",
        sellVolumeQuote: "0",
        buyPct: 50,
      };
    }
    const cutoff = Math.floor(Date.now() / 1000) - windowSec;
    let buyCount = 0;
    let sellCount = 0;
    let buyVolumeQuote = 0n;
    let sellVolumeQuote = 0n;
    for (const t of row.trades) {
      if (t.timestamp < cutoff) continue;
      if (t.side === "buy") {
        buyCount += 1;
        buyVolumeQuote += BigInt(t.quoteAmount);
      } else {
        sellCount += 1;
        sellVolumeQuote += BigInt(t.quoteAmount);
      }
    }
    const txns = buyCount + sellCount;
    const buyPct = txns > 0 ? (buyCount / txns) * 100 : 50;
    const volumeQuote = (buyVolumeQuote + sellVolumeQuote).toString();
    return {
      txns,
      volumeQuote,
      buyCount,
      sellCount,
      buyVolumeQuote: buyVolumeQuote.toString(),
      sellVolumeQuote: sellVolumeQuote.toString(),
      buyPct,
    };
  }

  activityByWindow(token: Address): Record<ActivityWindowKey, ActivityWindowStats> {
    return {
      "5m": this.activityStatsForWindow(token, ACTIVITY_WINDOWS["5m"]),
      "1h": this.activityStatsForWindow(token, ACTIVITY_WINDOWS["1h"]),
      "6h": this.activityStatsForWindow(token, ACTIVITY_WINDOWS["6h"]),
      "24h": this.activityStatsForWindow(token, ACTIVITY_WINDOWS["24h"]),
    };
  }

  devBuyInfo(token: Address) {
    const row = this.getToken(token);
    if (!row) return { completed: false as const };
    const creator = row.creator.toLowerCase();
    const buy = row.trades.find(
      (t) => t.side === "buy" && t.actor?.toLowerCase() === creator,
    );
    if (!buy) return { completed: false as const };
    return {
      completed: true as const,
      quoteSpent: buy.quoteAmount,
      tokensReceived: buy.tokenAmount,
      txHash: buy.txHash,
      timestamp: buy.timestamp,
    };
  }

  priceChanges(token: Address) {
    const row = this.getToken(token);
    if (!row || row.candles5m.length === 0) {
      return { change5m: null as number | null, change1h: null, change6h: null, change24h: null };
    }
    const now = Math.floor(Date.now() / 1000);
    const current = Number(row.candles5m[row.candles5m.length - 1]!.c);
    if (!(current > 0)) {
      return { change5m: null, change1h: null, change6h: null, change24h: null };
    }

    const pctAt = (secondsAgo: number) => {
      const target = now - secondsAgo;
      let ref = row.candles5m[0]!;
      for (const c of row.candles5m) {
        if (c.t <= target) ref = c;
        else break;
      }
      const base = Number(ref.o);
      if (!(base > 0)) return null;
      return ((current - base) / base) * 100;
    };

    return {
      change5m: pctAt(300),
      change1h: pctAt(3600),
      change6h: pctAt(21_600),
      change24h: pctAt(86_400),
    };
  }

  topHolders(token: Address, limit: number) {
    const row = this.getToken(token);
    if (!row) return [];
    const supply = BigInt(row.totalSupply || "0");
    return Object.entries(row.holders)
      .filter(([address]) => !this.isExcluded(address))
      .map(([address, balance]) => {
        const bal = BigInt(balance);
        const pct = supply > 0n ? Number((bal * 10_000n) / supply) / 100 : 0;
        return { address, balance, pct };
      })
      .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))
      .slice(0, limit);
  }

  candles(token: Address, limit: number, poolId?: string): Candle[] {
    const row = this.getToken(token);
    if (!row) return [];
    if (poolId) {
      const key = poolId.toLowerCase();
      const series = row.candles5mByPool?.[key];
      if (series?.length) return series.slice(-limit);
      // Rebuild from trades when older data lacked candles5mByPool.
      return this._candlesFromTrades(row, limit, key);
    }
    return row.candles5m.slice(-limit);
  }

  trades(token: Address, limit: number, offset = 0, poolId?: string): IndexedTrade[] {
    const row = this.getToken(token);
    if (!row) return [];
    const filtered = poolId
      ? row.trades.filter((t) => t.poolId?.toLowerCase() === poolId.toLowerCase())
      : row.trades;
    const slice = filtered.slice().reverse();
    return slice.slice(offset, offset + limit);
  }

  private _candlesFromTrades(row: TokenRow, limit: number, poolKey: string): Candle[] {
    const series: Candle[] = [];
    for (const trade of row.trades) {
      if (trade.poolId && trade.poolId.toLowerCase() !== poolKey) continue;
      if (!trade.poolId && row.poolId.toLowerCase() !== poolKey) continue;
      this._updateCandleSeries(series, trade);
    }
    return series.slice(-limit);
  }
}

export function tradeId(txHash: Hex, logIndex: number): string {
  return `${txHash.toLowerCase()}-${logIndex}`;
}

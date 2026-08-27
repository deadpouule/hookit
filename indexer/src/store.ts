import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";

import type { Candle, IndexedTrade, StoreFile, StoreFileV1, TokenRow } from "./config.js";
import { compareDec, maxDec, minDec } from "./math.js";

export const MAX_TRADES = 2_000;
export const MAX_CANDLES = 5_000;
export const MAX_SEEN_TRADES = 100_000;
const CANDLE_SEC = 300;
const SEC_24H = 86_400;

export function defaultDataDir(): string {
  return join(fileURLToPath(new URL("..", import.meta.url)), "data");
}

export function emptyStore(chainId: number): StoreFile {
  return {
    version: 2,
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
      if (raw.version === 2) {
        if (raw.chainId !== chainId) {
          throw new Error(`store chainId ${raw.chainId} != config ${chainId}`);
        }
        this.data = raw;
      } else {
        this.data = migrateV1(raw);
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
    this.data.tokens[key] = row;
    if (row.poolId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      this.data.poolToToken[row.poolId.toLowerCase()] = key;
    }
    this.data.launchIdToToken[String(row.launchId)] = key;
  }

  tokenForLaunchId(launchId: bigint | number): TokenRow | undefined {
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
    this._updateCandle(row, trade);
    return true;
  }

  private _updateCandle(row: TokenRow, trade: IndexedTrade) {
    const bucket = Math.floor(trade.timestamp / CANDLE_SEC) * CANDLE_SEC;
    const last = row.candles5m[row.candles5m.length - 1];
    if (!last || last.t !== bucket) {
      row.candles5m.push({
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
    if (row.candles5m.length > MAX_CANDLES) {
      row.candles5m = row.candles5m.slice(-MAX_CANDLES);
    }
  }

  stats24h(token: Address) {
    const row = this.getToken(token);
    if (!row) return { volume24h: "0", trades24h: 0, change24h: null as number | null };
    const cutoff = Math.floor(Date.now() / 1000) - SEC_24H;
    let volume = 0n;
    let trades24h = 0;
    for (const t of row.trades) {
      if (t.timestamp >= cutoff) {
        volume += BigInt(t.quoteAmount);
        trades24h += 1;
      }
    }
    const recent = row.trades.filter((t) => t.timestamp >= cutoff);
    let change24h: number | null = null;
    if (recent.length >= 2) {
      const first = Number(recent[0]!.price);
      const last = Number(recent[recent.length - 1]!.price);
      if (first > 0) change24h = ((last - first) / first) * 100;
    }
    return { volume24h: volume.toString(), trades24h, change24h };
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

  candles(token: Address, limit: number): Candle[] {
    const row = this.getToken(token);
    if (!row) return [];
    return row.candles5m.slice(-limit);
  }

  trades(token: Address, limit: number, offset = 0): IndexedTrade[] {
    const row = this.getToken(token);
    if (!row) return [];
    const slice = row.trades.slice().reverse();
    return slice.slice(offset, offset + limit);
  }
}

export function tradeId(txHash: Hex, logIndex: number): string {
  return `${txHash.toLowerCase()}-${logIndex}`;
}

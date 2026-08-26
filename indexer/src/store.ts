import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";

import type { Candle, IndexedTrade, StoreFile, TokenRow } from "./config.js";

const MAX_TRADES = 250;
const MAX_CANDLES = 2_000;
const CANDLE_SEC = 300;

export function defaultDataDir(): string {
  return join(fileURLToPath(new URL("..", import.meta.url)), "data");
}

export function emptyStore(chainId: number): StoreFile {
  return {
    version: 1,
    chainId,
    cursor: "0",
    updatedAt: 0,
    tokens: {},
    poolToToken: {},
  };
}

export class Store {
  readonly path: string;
  data: StoreFile;

  constructor(dataDir: string, chainId: number) {
    mkdirSync(dataDir, { recursive: true });
    this.path = join(dataDir, `hookit-${chainId}.json`);
    if (existsSync(this.path)) {
      this.data = JSON.parse(readFileSync(this.path, "utf8")) as StoreFile;
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

  getToken(address: string): TokenRow | undefined {
    return this.data.tokens[address.toLowerCase()];
  }

  upsertToken(row: TokenRow) {
    const key = row.address.toLowerCase();
    this.data.tokens[key] = row;
    this.data.poolToToken[row.poolId.toLowerCase()] = key;
  }

  tokenForPool(poolId: Hex | string): TokenRow | undefined {
    const key = this.data.poolToToken[poolId.toLowerCase()];
    return key ? this.data.tokens[key] : undefined;
  }

  applyTransfer(token: Address, from: Address, to: Address, value: bigint) {
    const row = this.getToken(token);
    if (!row) return;
    const f = from.toLowerCase();
    const t = to.toLowerCase();
    if (f !== "0x0000000000000000000000000000000000000000") {
      const next = BigInt(row.holders[f] ?? "0") - value;
      if (next <= 0n) delete row.holders[f];
      else row.holders[f] = next.toString();
    }
    if (t !== "0x0000000000000000000000000000000000000000") {
      row.holders[t] = (BigInt(row.holders[t] ?? "0") + value).toString();
    }
  }

  pushTrade(token: Address, trade: IndexedTrade) {
    const row = this.getToken(token);
    if (!row) return;
    row.trades.push(trade);
    if (row.trades.length > MAX_TRADES) {
      row.trades = row.trades.slice(-MAX_TRADES);
    }
    this._updateCandle(row, trade);
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

  topHolders(token: Address, limit: number) {
    const row = this.getToken(token);
    if (!row) return [];
    const supply = BigInt(row.totalSupply || "0");
    return Object.entries(row.holders)
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

  trades(token: Address, limit: number): IndexedTrade[] {
    const row = this.getToken(token);
    if (!row) return [];
    return row.trades.slice(-limit).reverse();
  }
}

function maxDec(a: string, b: string): string {
  return Number(a) >= Number(b) ? a : b;
}
function minDec(a: string, b: string): string {
  return Number(a) <= Number(b) ? a : b;
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { Address } from "viem";
import { getAddress, isAddress } from "viem";

import type { IndexerConfig } from "./config.js";
import { buildProtocolStats } from "./protocol-stats.js";
import type { Store } from "./store.js";

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function pathParts(url: string): string[] {
  const u = new URL(url, "http://localhost");
  return u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
}

function parseToken(raw: string | undefined): Address | null {
  if (!raw || !isAddress(raw)) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

function summarize(store: Store, address: Address) {
  const row = store.getToken(address);
  if (!row) return null;
  const last = row.trades[row.trades.length - 1];
  const holders = Object.keys(row.holders).length;
  const stats = store.stats24h(address);
  return {
    address: row.address,
    poolId: row.poolId,
    quote: row.quote,
    tokenIsCurrency0: row.tokenIsCurrency0,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    quoteDecimals: row.quoteDecimals,
    totalSupply: row.totalSupply,
    creator: row.creator,
    launchedAt: row.launchedAt,
    launchId: row.launchId,
    rail: row.rail,
    metadataURI: row.metadataURI ?? null,
    hookModules: row.hookModules ?? null,
    bondingPhase: row.bondingPhase ?? null,
    tokensSold: row.tokensSold ?? null,
    graduationQuote: row.graduationQuote ?? null,
    realQuote: row.realQuote ?? null,
    graduatedAt: row.graduatedAt ?? null,
    marketCount: row.marketCount ?? (row.markets?.length ? row.markets.length : 1),
    markets: row.markets ?? null,
    price: last?.price ?? null,
    lastTradeAt: last?.timestamp ?? null,
    tradesIndexed: row.trades.length,
    holdersIndexed: holders,
    candles5m: row.candles5m.length,
    volume24h: stats.volume24h,
    trades24h: stats.trades24h,
    change24h: stats.change24h,
  };
}

export function startApi(store: Store, cfg: IndexerConfig, getLatestBlock?: () => Promise<bigint>) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url || !req.method) {
      json(res, 400, { error: "bad request" });
      return;
    }
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }
    if (req.method !== "GET") {
      json(res, 405, { error: "method not allowed" });
      return;
    }

    const parts = pathParts(req.url);
    const u = new URL(req.url, "http://localhost");

    if (parts.length === 1 && parts[0] === "health") {
      let latestBlock: string | null = null;
      let lag: number | null = null;
      if (getLatestBlock) {
        try {
          const latest = await getLatestBlock();
          latestBlock = latest.toString();
          const cursor = BigInt(store.data.cursor || "0");
          lag = Number(latest > cursor ? latest - cursor : 0n);
        } catch {
          /* ignore */
        }
      }
      json(res, 200, {
        ok: !store.data.lastPollError,
        chainId: cfg.chainId,
        cursor: store.data.cursor,
        updatedAt: store.data.updatedAt,
        lastPollAt: store.data.lastPollAt ?? null,
        lastPollError: store.data.lastPollError ?? null,
        latestBlock,
        lagBlocks: lag,
        tokens: Object.keys(store.data.tokens).length,
      });
      return;
    }

    if (parts[0] === "v1" && parts[1] === "protocol" && parts[2] === "stats") {
      json(res, 200, buildProtocolStats(store));
      return;
    }

    if (parts[0] === "v1" && parts[1] === "tokens" && parts.length === 2) {
      const list = Object.values(store.data.tokens)
        .map((t) => summarize(store, t.address)!)
        .sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
      json(res, 200, { tokens: list });
      return;
    }

    if (parts[0] === "v1" && parts[1] === "tokens" && parts.length >= 3) {
      const token = parseToken(parts[2]);
      if (!token) {
        json(res, 400, { error: "invalid address" });
        return;
      }
      if (!store.getToken(token)) {
        json(res, 404, { error: "token not indexed yet" });
        return;
      }

      const limit = Math.min(Math.max(Number(u.searchParams.get("limit") ?? 50), 1), 500);
      const offset = Math.max(Number(u.searchParams.get("offset") ?? 0), 0);

      if (parts.length === 3) {
        json(res, 200, summarize(store, token));
        return;
      }

      if (parts[3] === "trades") {
        json(res, 200, {
          token: token.toLowerCase(),
          trades: store.trades(token, limit, offset),
        });
        return;
      }
      if (parts[3] === "holders") {
        json(res, 200, { token: token.toLowerCase(), holders: store.topHolders(token, limit) });
        return;
      }
      if (parts[3] === "candles") {
        const interval = u.searchParams.get("interval") ?? "5m";
        json(res, 200, {
          token: token.toLowerCase(),
          interval: interval === "5m" ? "5m" : "5m",
          candles: store.candles(token, limit),
        });
        return;
      }
    }

    json(res, 404, {
      error: "not found",
      routes: [
        "GET /health",
        "GET /v1/protocol/stats",
        "GET /v1/tokens",
        "GET /v1/tokens/:address",
        "GET /v1/tokens/:address/trades?limit=50&offset=0",
        "GET /v1/tokens/:address/holders?limit=50",
        "GET /v1/tokens/:address/candles?limit=200",
      ],
    });
  });

  server.listen(cfg.port, () => {
    console.log(`[indexer] API http://127.0.0.1:${cfg.port}`);
  });

  return server;
}

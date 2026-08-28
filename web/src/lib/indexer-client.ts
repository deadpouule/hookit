/**
 * Typed client for the house indexer — wire TokenDetail charts / trades / holders here.
 * Prefer same-origin `/api/indexer/...` so CORS and env stay on the server.
 */

export type IndexerTrade = {
  id: string;
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: number;
  timestamp: number;
  side: "buy" | "sell";
  quoteAmount: string;
  tokenAmount: string;
  price: string;
  sqrtPriceX96: string;
  actor?: string;
};

export type IndexerHolder = {
  address: string;
  balance: string;
  pct: number;
};

export type IndexerCandle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  vQuote: string;
  trades: number;
};

export type IndexerTokenSummary = {
  address: string;
  poolId: string;
  quote: string;
  tokenIsCurrency0: boolean;
  name: string;
  symbol: string;
  decimals: number;
  quoteDecimals: number;
  totalSupply: string;
  creator: string;
  launchedAt: number;
  launchId: number;
  rail: "master" | "classic";
  metadataURI: string | null;
  hookModules: string | null;
  bondingPhase: number | null;
  tokensSold: string | null;
  graduationQuote: string | null;
  realQuote: string | null;
  graduatedAt: number | null;
  price: string | null;
  lastTradeAt: number | null;
  tradesIndexed: number;
  holdersIndexed: number;
  candles5m: number;
  volume24h: string;
  trades24h: number;
  change24h: number | null;
};

export type IndexerHealth = {
  ok: boolean;
  configured?: boolean;
  chainId: number;
  cursor: string;
  updatedAt: number;
  lastPollAt: number | null;
  lastPollError: string | null;
  latestBlock: string | null;
  lagBlocks: number | null;
  tokens: number;
};

const base = () => "/api/indexer";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `indexer ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchIndexerHealth() {
  return getJson<IndexerHealth>("/health").then((health) =>
    health.configured === false ? { ...health, ok: false } : health,
  );
}

export function fetchIndexerTokens() {
  return getJson<{ tokens: IndexerTokenSummary[] }>("/v1/tokens");
}

export function fetchIndexerToken(address: string) {
  return getJson<IndexerTokenSummary>(`/v1/tokens/${address}`);
}

export function fetchIndexerTrades(address: string, limit = 50, offset = 0) {
  return getJson<{ token: string; trades: IndexerTrade[] }>(
    `/v1/tokens/${address}/trades?limit=${limit}&offset=${offset}`,
  );
}

export function fetchIndexerHolders(address: string, limit = 50) {
  return getJson<{ token: string; holders: IndexerHolder[] }>(
    `/v1/tokens/${address}/holders?limit=${limit}`,
  );
}

export function fetchIndexerCandles(address: string, limit = 200) {
  return getJson<{ token: string; interval: string; candles: IndexerCandle[] }>(
    `/v1/tokens/${address}/candles?limit=${limit}`,
  );
}

export function fetchIndexerProtocolStats() {
  return getJson<{
    tokensIndexed: number;
    tradesIndexed: number;
    windows: Record<string, unknown>;
    daily: unknown[];
    hourly: unknown[];
    recentTrades: unknown[];
  }>("/v1/protocol/stats");
}

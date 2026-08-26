/**
 * Typed client for the house indexer — wire TokenDetail charts / trades / holders here.
 * Prefer same-origin `/api/indexer/...` so CORS and env stay on the server.
 */

export type IndexerTrade = {
  txHash: `0x${string}`;
  blockNumber: number;
  timestamp: number;
  side: "buy" | "sell";
  quoteAmount: string;
  tokenAmount: string;
  price: string;
  sqrtPriceX96: string;
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
  totalSupply: string;
  creator: string;
  launchedAt: number;
  launchId: number;
  rail: "master" | "classic";
  price: string | null;
  lastTradeAt: number | null;
  tradesIndexed: number;
  holdersIndexed: number;
  candles5m: number;
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

export function fetchIndexerToken(address: string) {
  return getJson<IndexerTokenSummary>(`/v1/tokens/${address}`);
}

export function fetchIndexerTrades(address: string, limit = 50) {
  return getJson<{ token: string; trades: IndexerTrade[] }>(
    `/v1/tokens/${address}/trades?limit=${limit}`,
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

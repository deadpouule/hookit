/**
 * Typed client for the house indexer - wire TokenDetail charts / trades / holders here.
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
  poolId?: string;
};

const SEC_24H = 86_400;

/** 24h change/volume from pool-scoped trades — indexer list still mixes multi-pair ticks. */
export function statsFromIndexerTrades(
  trades: IndexerTrade[],
  windowSec = SEC_24H,
  nowSec = Math.floor(Date.now() / 1000),
): { change: number | null; volumeWei: bigint; trades: number } {
  const cutoff = nowSec - windowSec;
  const window = [...trades]
    .filter((t) => t.timestamp >= cutoff && Number(t.price) > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  let volumeWei = BigInt(0);
  for (const trade of window) {
    try {
      volumeWei += BigInt(trade.quoteAmount || "0");
    } catch {
      /* skip */
    }
  }
  if (window.length < 2) {
    return { change: null, volumeWei, trades: window.length };
  }
  const first = Number(window[0]!.price);
  const last = Number(window[window.length - 1]!.price);
  if (!(first > 0) || !Number.isFinite(last)) {
    return { change: null, volumeWei, trades: window.length };
  }
  return { change: ((last - first) / first) * 100, volumeWei, trades: window.length };
}

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
  change5m?: number | null;
  change1h?: number | null;
  change6h?: number | null;
  buyCount24h?: number;
  sellCount24h?: number;
  buyVolume24h?: string;
  sellVolume24h?: string;
  buyPct24h?: number;
  windows?: Record<
    "5m" | "1h" | "6h" | "24h",
    {
      txns: number;
      volumeQuote: string;
      buyCount: number;
      sellCount: number;
      buyVolumeQuote: string;
      sellVolumeQuote: string;
      buyPct: number;
    }
  >;
  devBuyCompleted?: boolean;
  devBuyQuoteSpent?: string | null;
  devBuyTokensReceived?: string | null;
  devBuyTxHash?: string | null;
  devBuyAt?: number | null;
  marketCount?: number;
  markets?: IndexerTokenMarket[] | null;
};

export type IndexerTokenMarket = {
  poolId: string;
  quote: string;
  bps: number;
  tokenIsCurrency0: boolean;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
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

function indexerBase(): string {
  if (typeof window === "undefined") {
    const direct = process.env.INDEXER_URL?.trim();
    if (direct) return direct.replace(/\/$/, "");
  }
  return "/api/indexer";
}

async function getJson<T>(path: string): Promise<T> {
  const init: RequestInit = { cache: "no-store" };
  if (typeof window === "undefined") {
    init.signal = AbortSignal.timeout(8_000);
  }
  const res = await fetch(`${indexerBase()}${path}`, init);
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

export function fetchIndexerToken(address: string, poolId?: string) {
  const q = poolId ? `?poolId=${encodeURIComponent(poolId)}` : "";
  return getJson<IndexerTokenSummary>(`/v1/tokens/${address}${q}`);
}

export function fetchIndexerTrades(address: string, limit = 50, offset = 0, poolId?: string) {
  const poolQ = poolId ? `&poolId=${encodeURIComponent(poolId)}` : "";
  return getJson<{ token: string; trades: IndexerTrade[] }>(
    `/v1/tokens/${address}/trades?limit=${limit}&offset=${offset}${poolQ}`,
  );
}

export function fetchIndexerHolders(address: string, limit = 50) {
  return getJson<{ token: string; holders: IndexerHolder[] }>(
    `/v1/tokens/${address}/holders?limit=${limit}`,
  );
}

export function fetchIndexerCandles(
  address: string,
  limit = 200,
  poolId?: string,
  interval: "1m" | "5m" | "10m" | "15m" | "1h" = "1m",
) {
  const poolQ = poolId ? `&poolId=${encodeURIComponent(poolId)}` : "";
  return getJson<{ token: string; interval: string; candles: IndexerCandle[] }>(
    `/v1/tokens/${address}/candles?limit=${limit}&interval=${interval}${poolQ}`,
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

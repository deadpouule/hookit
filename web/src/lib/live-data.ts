/** True when INDEXER_URL is set on the server. */
export function isIndexerConfigured(): boolean {
  const url = process.env.INDEXER_URL?.trim();
  return !!url && url.length > 0;
}

/**
 * Gate on-chain launch fetches.
 * Local dev uses the demo catalog — no RPC calls on localhost.
 * Production always hits `/api/launches` (server has factory env vars).
 */
export function shouldFetchLiveLaunches(): boolean {
  return process.env.NODE_ENV !== "development";
}

import { isFactoryConfigured } from "@/lib/contracts/config";

/** True when INDEXER_URL is set on the server. */
export function isIndexerConfigured(): boolean {
  const url = process.env.INDEXER_URL?.trim();
  return !!url && url.length > 0;
}

/**
 * Gate on-chain launch fetches.
 * Local dev ALWAYS uses the demo catalog — no RPC calls on localhost.
 * Production uses live data when factory addresses are configured.
 */
export function shouldFetchLiveLaunches(): boolean {
  if (process.env.NODE_ENV === "development") {
    return false;
  }
  return isFactoryConfigured();
}

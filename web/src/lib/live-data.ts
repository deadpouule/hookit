import { isFactoryConfigured } from "@/lib/contracts/config";

/** True when INDEXER_URL is set on the server. */
export function isIndexerConfigured(): boolean {
  const url = process.env.INDEXER_URL?.trim();
  return !!url && url.length > 0;
}

/**
 * Gate on-chain launch fetches. In local dev we default to the demo catalog
 * unless NEXT_PUBLIC_USE_LIVE_LAUNCHES=true — avoids hanging RPC when .env.local
 * has factory addresses but no working node.
 */
export function shouldFetchLiveLaunches(): boolean {
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXT_PUBLIC_USE_LIVE_LAUNCHES === "true";
  }
  return isFactoryConfigured();
}

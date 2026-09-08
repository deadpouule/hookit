import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";
import type { MarketToken } from "@/lib/market-tokens";
import type { TokenPool } from "@/lib/types";

const PLACEHOLDER_NAMES = new Set(["", "unknown", "unnamed"]);
const PLACEHOLDER_TICKERS = new Set(["", "???", "?", "unknown"]);

function catalogId(pool: Pick<TokenPool, "id" | "contractAddress">): string {
  return (pool.contractAddress ?? pool.id).toLowerCase();
}

export function isPlaceholderLaunchName(name?: string | null): boolean {
  return PLACEHOLDER_NAMES.has((name ?? "").trim().toLowerCase());
}

export function isPlaceholderLaunchTicker(ticker?: string | null): boolean {
  return PLACEHOLDER_TICKERS.has((ticker ?? "").trim().toLowerCase());
}

/** True when ERC20 name/symbol failed and the catalog fell back to Unknown / ???. */
export function isPlaceholderLaunchIdentity(
  pool: Pick<TokenPool, "name" | "ticker"> | Pick<MarketToken, "name" | "ticker">,
): boolean {
  return isPlaceholderLaunchName(pool.name) || isPlaceholderLaunchTicker(pool.ticker);
}

/**
 * Keep last-known names across flaky RPC refetches, and drop unresolved placeholders
 * so the explore grid never flashes Unknown / $??? cards.
 */
export function mergeLaunchCatalog(prev: TokenPool[] | undefined, next: TokenPool[]): TokenPool[] {
  const prevById = new Map((prev ?? []).map((pool) => [catalogId(pool), pool]));
  const merged: TokenPool[] = [];
  const seen = new Set<string>();

  for (const pool of next) {
    const id = catalogId(pool);
    const prior = prevById.get(id);
    const resolved =
      isPlaceholderLaunchIdentity(pool) && prior && !isPlaceholderLaunchIdentity(prior)
        ? {
            ...pool,
            name: prior.name,
            ticker: prior.ticker,
            image: pool.image || prior.image,
          }
        : pool;
    if (isPlaceholderLaunchIdentity(resolved)) continue;
    seen.add(id);
    merged.push(resolved);
  }

  for (const prior of prev ?? []) {
    const id = catalogId(prior);
    if (seen.has(id) || isPlaceholderLaunchIdentity(prior)) continue;
    seen.add(id);
    merged.push(prior);
  }

  return merged;
}

/** Normalize ticker for duplicate detection (case-insensitive, trimmed). */
export function tickerKey(ticker: string): string {
  return ticker.trim().toLowerCase();
}

/** Normalize name/ticker for duplicate detection (case-insensitive, trimmed). */
export function identityKey(name: string, ticker: string): string {
  return `${name.trim().toLowerCase()}::${ticker.trim().toLowerCase()}`;
}

/** True when the pool is quoted against a wrapped equity (RWA). */
export function isRwaQuote(quoteAsset?: string, quoteAddress?: string): boolean {
  if (!quoteAsset && !quoteAddress) return false;
  if (quoteAddress) {
    const addr = quoteAddress.toLowerCase();
    if (INK_QUOTRON_STOCKS.some((s) => s.address.toLowerCase() === addr)) return true;
  }
  if (quoteAsset) {
    const q = quoteAsset.toLowerCase();
    if (q.startsWith("w") && q.endsWith("x")) return true;
    return INK_QUOTRON_STOCKS.some((s) => s.symbol.toLowerCase() === q);
  }
  return false;
}

/**
 * Annotate tokens with OG / COPY flags.
 * OG only when another token shares the same ticker — first launch wins OG, later ones get COPY.
 * Unique tickers get no badge.
 */
export function annotateCopyFlags(tokens: MarketToken[]): MarketToken[] {
  const groups = new Map<string, MarketToken[]>();

  for (const token of tokens) {
    if (isPlaceholderLaunchTicker(token.ticker)) continue;
    const key = tickerKey(token.ticker);
    const group = groups.get(key) ?? [];
    group.push(token);
    groups.set(key, group);
  }

  const flags = new Map<string, { isOriginal?: boolean; isCopycat?: boolean }>();

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const sorted = [...group].sort((a, b) => a.launchedAt - b.launchedAt);
    flags.set(sorted[0].id, { isOriginal: true });
    for (let i = 1; i < sorted.length; i++) {
      flags.set(sorted[i].id, { isCopycat: true });
    }
  }

  return tokens.map((token) => {
    const f = flags.get(token.id);
    if (!f) return token;
    return { ...token, ...f };
  });
}

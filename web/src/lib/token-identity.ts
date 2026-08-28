import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";
import type { MarketToken } from "@/lib/market-tokens";

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
 * Annotate tokens with OG / copycat flags.
 * First launch of a name+ticker pair gets `isOriginal`; later ones get `isCopycat`.
 */
export function annotateCopyFlags(tokens: MarketToken[]): MarketToken[] {
  const groups = new Map<string, MarketToken[]>();

  for (const token of tokens) {
    const key = identityKey(token.name, token.ticker);
    const group = groups.get(key) ?? [];
    group.push(token);
    groups.set(key, group);
  }

  const flags = new Map<string, { isOriginal?: boolean; isCopycat?: boolean }>();

  for (const group of groups.values()) {
    if (group.length <= 1) {
      flags.set(group[0].id, { isOriginal: true });
      continue;
    }
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

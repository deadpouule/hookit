import type { MarketToken } from "@/lib/market-tokens";
import { bondProgress, isBonded, MARKET_NOW } from "@/lib/market-tokens";

export const TRENDING_MAX = 8;
export const TOP_BADGE_COUNT = 3;
/** 1h move required to count as trend. Flat 0.00% prints are not trending. */
export const TRENDING_MIN_CHANGE = 2;
export const LIVE_FEED_WINDOW_MS = 1000 * 60 * 60 * 48;
export const ALMOST_BONDED_MIN_PCT = 40;

export type SortKey = "top" | "trend" | "almostBonded" | "live";

export type MarketRankings = {
  topIds: Set<string>;
  trendingIds: Set<string>;
  moverIds: Set<string>;
};

export function buildMarketRankings(tokens: MarketToken[]): MarketRankings {
  const topIds = new Set(
    [...tokens]
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, TOP_BADGE_COUNT)
      .map((token) => token.id),
  );

  const trendingIds = new Set(
    [...tokens]
      .filter((token) => token.change1h >= TRENDING_MIN_CHANGE)
      .sort((a, b) => b.change1h - a.change1h)
      .slice(0, TRENDING_MAX)
      .map((token) => token.id),
  );

  const moverIds = new Set(
    [...tokens]
      .sort((a, b) => Math.abs(b.change1h) - Math.abs(a.change1h))
      .slice(0, TRENDING_MAX)
      .map((token) => token.id),
  );

  return { topIds, trendingIds, moverIds };
}

export function isTrendMover(token: MarketToken): boolean {
  return token.change1h >= TRENDING_MIN_CHANGE;
}

export function selectTrendingTokens(tokens: MarketToken[], count = TRENDING_MAX): MarketToken[] {
  return [...tokens]
    .filter(isTrendMover)
    .sort((a, b) => b.change1h - a.change1h)
    .slice(0, count);
}

export function isTopToken(token: MarketToken, rankings: MarketRankings): boolean {
  return rankings.topIds.has(token.id);
}

export function isTrendingToken(token: MarketToken, rankings: MarketRankings): boolean {
  return rankings.trendingIds.has(token.id);
}

export function isLiveLaunch(token: MarketToken, now = MARKET_NOW): boolean {
  return now - token.launchedAt <= LIVE_FEED_WINDOW_MS;
}

export function isAlmostBondedToken(token: MarketToken): boolean {
  if (token.rail !== "classic" || token.hookType !== "Classic") return false;
  if (token.bondingPhase !== 0 || isBonded(token)) return false;
  return bondProgress(token) >= ALMOST_BONDED_MIN_PCT;
}

export function filterBySort(tokens: MarketToken[], sort: SortKey): MarketToken[] {
  if (sort === "trend") return tokens.filter(isTrendMover);
  if (sort === "almostBonded") {
    return tokens.filter(isAlmostBondedToken);
  }
  if (sort === "live") {
    return tokens.filter(isLiveLaunch);
  }
  return tokens;
}

export function sortTokens(tokens: MarketToken[], sort: SortKey): MarketToken[] {
  const next = [...tokens];
  if (sort === "top") return next.sort((a, b) => b.marketCap - a.marketCap);
  if (sort === "trend") return next.sort((a, b) => b.change1h - a.change1h);
  if (sort === "almostBonded") {
    return next.sort((a, b) => bondProgress(b) - bondProgress(a));
  }
  return next.sort((a, b) => b.launchedAt - a.launchedAt);
}

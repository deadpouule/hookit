import type { MarketToken } from "@/lib/market-tokens";
import type { MarketRankings } from "@/lib/market-rankings";
import { TRENDING_MAX } from "@/lib/market-rankings";

import { TrendingTokenCard } from "./TrendingTokenCard";

type TrendingStripProps = {
  tokens: MarketToken[];
  rankings: MarketRankings;
};

export function TrendingStrip({ tokens, rankings }: TrendingStripProps) {
  const items = tokens.slice(0, TRENDING_MAX);

  return (
    <div className="trending-strip no-scrollbar">
      {items.map((token) => (
        <TrendingTokenCard
          key={token.id}
          token={token}
          isTop={rankings.topIds.has(token.id)}
          isTrending={rankings.trendingIds.has(token.id)}
        />
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useLaunches } from "@/hooks/useLaunches";
import { isFactoryConfigured } from "@/lib/contracts/config";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  buildDemoMarketTokens,
  poolToMarketToken,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { annotateCopyFlags } from "@/lib/token-identity";
import { cn } from "@/lib/utils";

import { bondProgress } from "@/lib/market-tokens";
import { MarketplaceToolbar, type CategoryKey, type SortKey } from "./MarketplaceToolbar";
import { BondMeter, MarketTokenCard } from "./MarketTokenCard";
import { TrendingCarousel } from "./TrendingCarousel";
import { TokenArt } from "./TokenArt";
import { TokenCopyBadge, TokenTypeBadges } from "./TokenBadges";

type LayoutMode = "grid" | "table";

function sortTokens(tokens: MarketToken[], sort: SortKey) {
  const next = [...tokens];
  if (sort === "top") return next.sort((a, b) => b.marketCap - a.marketCap);
  if (sort === "movers") return next.sort((a, b) => Math.abs(b.change1h) - Math.abs(a.change1h));
  if (sort === "almostBonded") {
    return next.sort((a, b) => {
      const aBond = a.rail === "classic" && a.hookType === "Classic" ? bondProgress(a) : -1;
      const bBond = b.rail === "classic" && b.hookType === "Classic" ? bondProgress(b) : -1;
      return bBond - aBond;
    });
  }
  return next.sort((a, b) => b.launchedAt - a.launchedAt);
}

function filterByCategory(tokens: MarketToken[], category: CategoryKey): MarketToken[] {
  if (category === "master") {
    return tokens.filter((t) => t.hookType === "Master" || (t.rail === "master" && t.hookType !== "Custom"));
  }
  if (category === "customs") {
    return tokens.filter((t) => t.hookType === "Custom" || t.kind === "sushi");
  }
  if (category === "rwa") {
    return tokens.filter((t) => t.isRwa);
  }
  return tokens;
}

export function Marketplace() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("top");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const factoryConfigured = isFactoryConfigured();
  const liveLaunches = shouldFetchLiveLaunches();
  const { data: onChainPools, isLoading, isError } = useLaunches();

  const sourceTokens = useMemo(() => {
    const demoTokens = buildDemoMarketTokens();

    if (liveLaunches && onChainPools && onChainPools.length > 0) {
      return annotateCopyFlags(onChainPools.map(poolToMarketToken));
    }

    if (!liveLaunches || process.env.NODE_ENV === "development") {
      return annotateCopyFlags(demoTokens);
    }

    return [];
  }, [liveLaunches, onChainPools]);

  const tokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sourceTokens.filter((token) => {
      const matchesQuery =
        !q ||
        token.name.toLowerCase().includes(q) ||
        token.ticker.toLowerCase().includes(q) ||
        token.description.toLowerCase().includes(q) ||
        token.creator.toLowerCase().includes(q);
      return matchesQuery;
    });
    const categorized = filterByCategory(filtered, category);
    return sortTokens(categorized, sort);
  }, [query, sort, category, sourceTokens]);

  const trending = useMemo(
    () => [...sourceTokens].sort((a, b) => b.change1h - a.change1h).slice(0, 8),
    [sourceTokens],
  );

  return (
    <div className="space-y-5">
      {!liveLaunches && process.env.NODE_ENV === "development" && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
          Local dev — demo catalog. Set{" "}
          <code className="text-zinc-200">NEXT_PUBLIC_USE_LIVE_LAUNCHES=true</code> to sync on-chain
          launches.
        </p>
      )}
      {liveLaunches && isLoading && (
        <p className="text-xs text-zinc-500">Syncing on-chain launches…</p>
      )}
      {liveLaunches && isError && (
        <p className="text-xs text-amber-400">
          Could not load launches from the factory. Showing demo catalog — check RPC / factory address.
        </p>
      )}
      {liveLaunches && !isLoading && !isError && onChainPools?.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
          No launches yet — be the first from{" "}
          <Link href="/launch" className="text-zinc-200 underline">
            Launch
          </Link>
          .
        </p>
      )}
      {!factoryConfigured && !liveLaunches && process.env.NODE_ENV !== "development" && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
          Set <code className="text-zinc-200">NEXT_PUBLIC_LAUNCH_FACTORY</code> /{" "}
          <code className="text-zinc-200">NEXT_PUBLIC_BONDING_FACTORY</code> after deploy to list live
          tokens. Showing demo catalog.
        </p>
      )}

      <section id="party" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="terminal-title text-sm font-semibold text-white">Trending now</h2>
        </div>
        <TrendingCarousel tokens={trending} />
      </section>

      <section id="tokens" className="scroll-mt-24 space-y-4">
        <MarketplaceToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          category={category}
          onCategoryChange={setCategory}
          layout={layout}
          onLayoutChange={setLayout}
        />

        {layout === "grid" ? (
          <div className="token-grid">
            {tokens.map((token) => (
              <MarketTokenCard key={token.id} token={token} />
            ))}
          </div>
        ) : (
          <TokenTable tokens={tokens} />
        )}
      </section>
    </div>
  );
}

function TokenTable({ tokens }: { tokens: MarketToken[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#141416]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[11px] tracking-wide text-zinc-500 uppercase">
          <tr className="border-b border-white/[0.08]">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium">Market Cap</th>
            <th className="px-4 py-3 font-medium">Volume</th>
            <th className="px-4 py-3 font-medium">1h</th>
            <th className="px-4 py-3 font-medium">Bond</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr
              key={token.id}
              className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3">
                <Link href={tokenHref(token.id)} className="flex items-center gap-3">
                  <div className="relative">
                    <TokenArt
                      token={token}
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      glyphClassName="text-base"
                    />
                    <TokenCopyBadge token={token} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{token.name}</p>
                    <p className="font-mono text-[11px] text-zinc-500">${token.ticker}</p>
                    <TokenTypeBadges token={token} />
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-100">{formatUsd(token.marketCap)}</td>
              <td className="px-4 py-3 text-zinc-300">{formatUsd(token.volume)}</td>
              <td className={cn("px-4 py-3 font-medium", token.change1h >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatPercent(token.change1h, true)}
              </td>
              <td className="px-4 py-3">
                <BondMeter token={token} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { HookitLogo } from "@/components/brand/HookitLogo";
import { useLaunches } from "@/hooks/useLaunches";
import { MOCK_POOLS } from "@/lib/constants";
import { isFactoryConfigured } from "@/lib/contracts/config";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  buildDemoMarketTokens,
  poolToMarketToken,
  type MarketToken,
} from "@/lib/market-tokens";
import { parseHooksParam, parseQuoteParam, serializeHooksParam } from "@/lib/market-hook-filter";
import {
  buildMarketRankings,
  filterBySort,
  selectTrendingTokens,
  sortTokens,
} from "@/lib/market-rankings";
import type { SortKey } from "@/lib/market-rankings";
import { poolsMatchingAnyMasterHooks, MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import { tokenHref } from "@/lib/routes";
import { annotateCopyFlags } from "@/lib/token-identity";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

import { MarketplaceToolbar, type CategoryKey } from "./MarketplaceToolbar";
import { BondMeter, MarketTokenCard } from "./MarketTokenCard";
import { TrendingStrip } from "./TrendingStrip";
import { TokenArt } from "./TokenArt";
import { TokenCopyBadge, TokenTypeBadges } from "./TokenBadges";

type LayoutMode = "grid" | "table";

function filterByCategory(tokens: MarketToken[], category: CategoryKey, rwaQuote: string | null): MarketToken[] {
  if (category === "master") {
    return tokens.filter((t) => t.hookType === "Master" || (t.rail === "master" && t.hookType !== "Custom"));
  }
  if (category === "customs") {
    return tokens.filter((t) => t.hookType === "Custom" || t.kind === "sushi");
  }
  if (category === "rwa") {
    const rwaTokens = tokens.filter((t) => t.isRwa);
    if (!rwaQuote) return rwaTokens;
    const quoteKey = rwaQuote.toLowerCase();
    return rwaTokens.filter((t) => t.quoteAsset?.toLowerCase() === quoteKey);
  }
  return tokens;
}

function parseCategoryParam(value: string | null): CategoryKey {
  if (value === "master" || value === "customs" || value === "rwa") return value;
  return "all";
}

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("top");
  const [category, setCategory] = useState<CategoryKey>(() => parseCategoryParam(searchParams.get("category")));
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const factoryConfigured = isFactoryConfigured();
  const liveLaunches = shouldFetchLiveLaunches();
  const { data: onChainPools, isLoading, isError } = useLaunches();

  const selectedHooks = useMemo(
    () => parseHooksParam(searchParams.get("hooks")),
    [searchParams],
  );

  const selectedRwaQuote = useMemo(
    () => parseQuoteParam(searchParams.get("quote")),
    [searchParams],
  );

  useEffect(() => {
    setCategory(parseCategoryParam(searchParams.get("category")));
  }, [searchParams]);

  const syncFiltersToUrl = useCallback(
    (nextCategory: CategoryKey, nextHooks: MasterHookId[], nextQuote: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextCategory === "all") {
        params.delete("category");
        params.delete("hooks");
        params.delete("quote");
      } else {
        params.set("category", nextCategory);
        if (nextCategory === "master") {
          params.delete("quote");
          if (nextHooks.length > 0) {
            params.set("hooks", serializeHooksParam(nextHooks));
          } else {
            params.delete("hooks");
          }
        } else if (nextCategory === "rwa") {
          params.delete("hooks");
          if (nextQuote) {
            params.set("quote", nextQuote);
          } else {
            params.delete("quote");
          }
        } else {
          params.delete("hooks");
          params.delete("quote");
        }
      }

      const qs = params.toString();
      router.replace(qs ? `/?${qs}#tokens` : "/#tokens", { scroll: false });
    },
    [router, searchParams],
  );

  const sourcePools = useMemo((): TokenPool[] => {
    if (liveLaunches && onChainPools && onChainPools.length > 0) {
      return onChainPools;
    }
    return MOCK_POOLS;
  }, [liveLaunches, onChainPools]);

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

  const rankings = useMemo(() => buildMarketRankings(sourceTokens), [sourceTokens]);

  const trending = useMemo(() => selectTrendingTokens(sourceTokens), [sourceTokens]);

  const tokens = useMemo(() => {
    const q = query.trim().toLowerCase();

    let scopedTokens = sourceTokens;
    if (category === "master" && selectedHooks.length > 0) {
      scopedTokens = annotateCopyFlags(
        poolsMatchingAnyMasterHooks(sourcePools, selectedHooks).map(poolToMarketToken),
      );
    }

    const filtered = scopedTokens.filter((token) => {
      const matchesQuery =
        !q ||
        token.name.toLowerCase().includes(q) ||
        token.ticker.toLowerCase().includes(q) ||
        token.description.toLowerCase().includes(q) ||
        token.creator.toLowerCase().includes(q);
      return matchesQuery;
    });

    const categorized = filterByCategory(filtered, category, selectedRwaQuote);
    const sortedScope = filterBySort(categorized, sort);
    return sortTokens(sortedScope, sort);
  }, [query, sort, category, selectedHooks, selectedRwaQuote, sourcePools, sourceTokens]);

  const handleCategoryChange = (nextCategory: CategoryKey) => {
    setCategory(nextCategory);
    syncFiltersToUrl(nextCategory, [], null);
  };

  const handleActivateMaster = () => {
    setCategory("master");
    syncFiltersToUrl("master", [], null);
  };

  const handleMasterHooksChange = (nextHooks: MasterHookId[]) => {
    setCategory("master");
    syncFiltersToUrl("master", nextHooks, null);
  };

  const handleActivateRwa = () => {
    setCategory("rwa");
    syncFiltersToUrl("rwa", [], null);
  };

  const handleRwaQuoteChange = (nextQuote: string | null) => {
    setCategory("rwa");
    syncFiltersToUrl("rwa", [], nextQuote);
  };

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
        <TrendingStrip tokens={trending} rankings={rankings} />
      </section>

      <section id="tokens" className="scroll-mt-24 space-y-4">
        <MarketplaceToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          category={category}
          onCategoryChange={handleCategoryChange}
          masterHooks={selectedHooks}
          onMasterHooksChange={handleMasterHooksChange}
          onActivateMaster={handleActivateMaster}
          rwaQuote={selectedRwaQuote}
          onRwaQuoteChange={handleRwaQuoteChange}
          onActivateRwa={handleActivateRwa}
          layout={layout}
          onLayoutChange={setLayout}
        />

        {category === "master" && selectedHooks.length > 0 && (
          <p className="text-xs text-zinc-500">
            Showing tokens using{" "}
            <span className="text-zinc-300">
              {selectedHooks
                .map((hookId) => MASTER_HOOKS.find((hook) => hook.id === hookId)?.title ?? hookId)
                .join(", ")}
            </span>
            .
          </p>
        )}

        {category === "rwa" && selectedRwaQuote && (
          <p className="text-xs text-zinc-500">
            Showing pools paired with <span className="text-zinc-300">{selectedRwaQuote}</span>.
          </p>
        )}

        {tokens.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-zinc-400">
            No tokens match this filter.
          </p>
        ) : layout === "grid" ? (
          <div className="token-grid">
            {tokens.map((token) => (
              <MarketTokenCard
                key={token.id}
                token={token}
                masterHookFilters={selectedHooks}
                onMasterHookFiltersChange={handleMasterHooksChange}
              />
            ))}
          </div>
        ) : (
          <TokenTable
            tokens={tokens}
            selectedHooks={selectedHooks}
            onMasterHooksChange={handleMasterHooksChange}
          />
        )}
      </section>
    </div>
  );
}

export function Marketplace() {
  return (
    <Suspense
      fallback={
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-zinc-400">
          Loading marketplace…
        </p>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}

function TokenTable({
  tokens,
  selectedHooks,
  onMasterHooksChange,
}: {
  tokens: MarketToken[];
  selectedHooks: MasterHookId[];
  onMasterHooksChange: (hooks: MasterHookId[]) => void;
}) {
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
                    <p className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                      <HookitLogo size="xs" />
                      ${token.ticker}
                    </p>
                    <TokenTypeBadges
                      token={token}
                      masterHookFilters={selectedHooks}
                      onMasterHookFiltersChange={onMasterHooksChange}
                    />
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

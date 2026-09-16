"use client";

import { Suspense, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { HookCard } from "@/components/explore/HookCard";
import { HookDocsDialog } from "@/components/explore/HookDocsDialog";
import { useLaunches } from "@/hooks/useLaunches";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import {
  MASTER_HOOK_FILTERS,
  EXPLORE_HOOKS,
  countHookUsage,
  type BrowseHook,
  type MasterHookCategory,
  type MasterHookId,
} from "@/lib/master-hooks";
import { resolveTokenModules } from "@/lib/launch-module-summary";
import { SEARCH_FIELD_PROPS } from "@/lib/search-field";
import type { TokenPool } from "@/lib/types";

type HookFilter = "all" | MasterHookCategory;

function ExplorePageContent({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  const [category, setCategory] = useState<HookFilter>("all");
  const [query, setQuery] = useState("");
  const [openHook, setOpenHook] = useState<BrowseHook | null>(null);
  const { data: onChainPools, isFetched } = useLaunches(initialPools);

  const pools = useMemo((): TokenPool[] => {
    const source = onChainPools ?? initialPools;
    if (shouldFetchLiveLaunches() || initialPools.length > 0) {
      return source.filter((pool) => pool.name && pool.ticker);
    }
    return [];
  }, [onChainPools, initialPools]);

  const usage = useMemo(() => countHookUsage(pools), [pools]);
  const usesPending = pools.length === 0 && !isFetched && initialPools.length === 0;

  const fixedFeeUses = useMemo(() => {
    return pools.filter((pool) => {
      if (pool.hookType === "Classic" || pool.hooks.customHook) return false;
      const resolved = resolveTokenModules(pool);
      return Boolean(resolved && resolved.hookTaxBps > 0 && !resolved.modules.dynamicFees);
    }).length;
  }, [pools]);

  const withUses = useMemo(
    () =>
      EXPLORE_HOOKS.map((hook) => ({
        ...hook,
        uses: hook.id === "fixed-fee" ? fixedFeeUses : usage[hook.id as MasterHookId] ?? 0,
      })),
    [usage, fixedFeeUses],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<HookFilter, number> = {
      all: EXPLORE_HOOKS.length,
      protection: 0,
      tokenomics: 0,
      rewards: 0,
      "trading-fees": 0,
    };
    for (const hook of EXPLORE_HOOKS) {
      counts[hook.category] += 1;
    }
    return counts;
  }, []);

  const totalUses = useMemo(
    () => withUses.reduce((sum, hook) => sum + hook.uses, 0),
    [withUses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withUses.filter((hook) => {
      const matchesCategory = category === "all" || hook.category === category;
      const matchesQuery =
        !q ||
        hook.title.toLowerCase().includes(q) ||
        hook.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, withUses]);

  return (
    <div className="market-shell hooks-discover bg-background pt-8 pb-12">
      <header className="hooks-discover-hero">
        <p className="hooks-discover-kicker">Master modules</p>
        <h1 className="hooks-discover-title">Hooks</h1>
        <p className="hooks-discover-lede">
          One-click Uniswap v4 modules. Pick a strategy, launch in a click.
        </p>
        <p className="hooks-discover-meta">
          {EXPLORE_HOOKS.length} modules
          <span aria-hidden>·</span>
          {usesPending ? "…" : `${totalUses} live uses`}
        </p>
      </header>

      <div className="hooks-discover-toolbar" suppressHydrationWarning>
        <div className="hooks-discover-search" suppressHydrationWarning>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            {...SEARCH_FIELD_PROPS}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hooks…"
            className="hooks-discover-search-input"
          />
        </div>

        <div className="hooks-filter-range" role="tablist" aria-label="Hook category">
          {MASTER_HOOK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={category === filter.id}
              onClick={() => setCategory(filter.id)}
              className={category === filter.id ? "is-on" : undefined}
            >
              {filter.label}
              <span className="hooks-filter-count">{categoryCounts[filter.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="hook-grid">
        {filtered.map((hook) => (
          <HookCard
            key={hook.id}
            hook={hook}
            usesPending={usesPending}
            onOpen={setOpenHook}
          />
        ))}
      </div>

      <HookDocsDialog hook={openHook} onOpenChange={(open) => { if (!open) setOpenHook(null); }} />

      {filtered.length === 0 && (
        <div className="hooks-discover-empty">
          <Sparkles className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hooks match those filters</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-6 text-sm text-[#03b1ed] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

export function ExplorePage({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  return (
    <Suspense
      fallback={
        <div className="market-shell hooks-discover bg-background pt-8 pb-10">
          <p className="text-sm text-muted-foreground">Loading hooks…</p>
        </div>
      }
    >
      <ExplorePageContent initialPools={initialPools} />
    </Suspense>
  );
}

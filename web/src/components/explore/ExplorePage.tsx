"use client";

import { Suspense, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { HookCard } from "@/components/explore/HookCard";
import { useLaunches } from "@/hooks/useLaunches";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import {
  MASTER_HOOK_FILTERS,
  EXPLORE_HOOKS,
  countHookUsage,
  type BrowseHookId,
  type MasterHookCategory,
  type MasterHookId,
} from "@/lib/master-hooks";
import { resolveTokenModules } from "@/lib/launch-module-summary";
import { SEARCH_FIELD_PROPS } from "@/lib/search-field";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

type HookFilter = "all" | MasterHookCategory;

function ExplorePageContent() {
  const [category, setCategory] = useState<HookFilter>("all");
  const [query, setQuery] = useState("");
  const { data: onChainPools } = useLaunches();

  const pools = useMemo((): TokenPool[] => {
    if (shouldFetchLiveLaunches()) {
      return onChainPools ?? [];
    }
    return [];
  }, [onChainPools]);

  const usage = useMemo(() => countHookUsage(pools), [pools]);

  const fixedFeeUses = useMemo(() => {
    return pools.filter((pool) => {
      if (pool.hookType === "Classic" || pool.hooks.customHook) return false;
      const resolved = resolveTokenModules(pool);
      return Boolean(resolved && resolved.hookTaxBps > 0 && !resolved.modules.dynamicFees);
    }).length;
  }, [pools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXPLORE_HOOKS.filter((hook) => {
      const matchesCategory = category === "all" || hook.category === category;
      const matchesQuery =
        !q ||
        hook.title.toLowerCase().includes(q) ||
        hook.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    }).map((hook) => ({
      ...hook,
      uses:
        hook.id === "fixed-fee"
          ? fixedFeeUses
          : usage[hook.id as MasterHookId] ?? 0,
    }));
  }, [category, query, usage, fixedFeeUses]);

  return (
    <div className="market-shell space-y-6 bg-background pt-8 pb-10">
      <div className="max-w-xl space-y-2">
        <h1 className="terminal-title text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Discover one click hooks
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Browse our Hooks, pick your strategy, and deploy your token in one click
        </p>
      </div>

      <div
        className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        suppressHydrationWarning
      >
        <div className="relative w-full max-w-xl" suppressHydrationWarning>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            {...SEARCH_FIELD_PROPS}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search master hooks…"
            className="h-11 w-full rounded-xl border border-border bg-card pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#9514d1]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-full bg-card p-1">
          {MASTER_HOOK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setCategory(filter.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                category === filter.id
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hook-grid">
        {filtered.map((hook) => (
          <HookCard key={hook.id} hook={hook} pools={pools} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-16 text-center">
          <Sparkles className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No master hooks match your filters</p>
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

export function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="market-shell bg-background pt-8 pb-10">
          <p className="text-sm text-muted-foreground">Loading hooks…</p>
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}

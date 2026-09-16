"use client";

import { Suspense, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { HookCard } from "@/components/explore/HookCard";
import { HookComboBar } from "@/components/explore/HookComboBar";
import { HookDocsDialog } from "@/components/explore/HookDocsDialog";
import { HookFeatured } from "@/components/explore/HookFeatured";
import { useLaunches } from "@/hooks/useLaunches";
import { shouldFetchLiveLaunches } from "@/lib/live-data";
import {
  MASTER_HOOK_FILTERS,
  EXPLORE_HOOKS,
  countHookUsage,
  pickFeaturedHook,
  poolsUsingMasterHook,
  type BrowseHook,
  type BrowseHookId,
  type MasterHookCategory,
  type MasterHookId,
} from "@/lib/master-hooks";
import { resolveTokenModules } from "@/lib/launch-module-summary";
import { SEARCH_FIELD_PROPS } from "@/lib/search-field";
import type { TokenPool } from "@/lib/types";

type HookFilter = "all" | MasterHookCategory;

function livePoolsForHook(pools: TokenPool[], hook: BrowseHook): TokenPool[] {
  if (hook.id === "fixed-fee") {
    return pools.filter((pool) => {
      if (pool.hookType === "Classic" || pool.hooks.customHook) return false;
      const resolved = resolveTokenModules(pool);
      return Boolean(resolved && resolved.hookTaxBps > 0 && !resolved.modules.dynamicFees);
    });
  }
  return poolsUsingMasterHook(pools, hook.id);
}

function ExplorePageContent({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  const [category, setCategory] = useState<HookFilter>("all");
  const [query, setQuery] = useState("");
  const [openHook, setOpenHook] = useState<BrowseHook | null>(null);
  const [combo, setCombo] = useState<BrowseHook[]>([]);
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

  const liveByHook = useMemo(() => {
    const map = new Map<BrowseHookId, TokenPool[]>();
    for (const hook of withUses) {
      map.set(hook.id, livePoolsForHook(pools, hook));
    }
    return map;
  }, [pools, withUses]);

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

  const featured = useMemo(() => pickFeaturedHook(filtered), [filtered]);
  const gridHooks = useMemo(
    () => (featured ? filtered.filter((hook) => hook.id !== featured.id) : filtered),
    [filtered, featured],
  );

  const toggleCombo = (hook: BrowseHook) => {
    setCombo((prev) =>
      prev.some((item) => item.id === hook.id)
        ? prev.filter((item) => item.id !== hook.id)
        : [...prev, hook],
    );
  };

  return (
    <div className="market-shell space-y-6 bg-background pt-8 pb-28">
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

        <div className="hooks-filter-range" role="tablist">
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
            </button>
          ))}
        </div>
      </div>

      {featured ? (
        <HookFeatured
          hook={featured}
          livePools={liveByHook.get(featured.id) ?? []}
          usesPending={usesPending}
          inCombo={combo.some((item) => item.id === featured.id)}
          onOpen={setOpenHook}
          onToggleCombo={toggleCombo}
        />
      ) : null}

      <div className="hook-grid">
        {gridHooks.map((hook) => (
          <HookCard
            key={hook.id}
            hook={hook}
            usesPending={usesPending}
            livePools={liveByHook.get(hook.id) ?? []}
            inCombo={combo.some((item) => item.id === hook.id)}
            onOpen={setOpenHook}
            onToggleCombo={toggleCombo}
          />
        ))}
      </div>

      <HookComboBar
        selected={combo}
        onRemove={(hook) => setCombo((prev) => prev.filter((item) => item.id !== hook.id))}
      />

      <HookDocsDialog hook={openHook} onOpenChange={(open) => { if (!open) setOpenHook(null); }} />

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

export function ExplorePage({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  return (
    <Suspense
      fallback={
        <div className="market-shell bg-background pt-8 pb-10">
          <p className="text-sm text-muted-foreground">Loading hooks…</p>
        </div>
      }
    >
      <ExplorePageContent initialPools={initialPools} />
    </Suspense>
  );
}

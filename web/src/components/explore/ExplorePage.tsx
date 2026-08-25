"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Flame,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { TokenCard } from "@/components/explore/TokenCard";
import { TokenCardSkeleton } from "@/components/explore/TokenCardSkeleton";
import { useLaunches } from "@/hooks/useLaunches";
import { MOCK_POOLS, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import type { ExploreCategory, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: {
  id: ExploreCategory;
  label: string;
  icon: typeof Trophy;
  badge?: string;
}[] = [
  { id: "top", label: "Top", icon: Trophy },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "newest", label: "Newest", icon: Sparkles },
  { id: "custom", label: "Custom", icon: TrendingUp, badge: "NEW" },
];

function filterPools(pools: TokenPool[], category: ExploreCategory, query: string) {
  let result = [...pools];

  switch (category) {
    case "trending":
      result.sort((a, b) => {
        const volA = a.volume24h ?? 0;
        const volB = b.volume24h ?? 0;
        return volB - volA || b.change24h - a.change24h;
      });
      break;
    case "newest":
      result.sort((a, b) => (b.launchId ?? 0) - (a.launchId ?? 0) || (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
      break;
    case "custom":
      result = result.filter((p) => p.hooks.customHook);
      result.sort((a, b) => (b.launchId ?? 0) - (a.launchId ?? 0));
      break;
    case "top":
    default:
      result.sort((a, b) => b.marketCap - a.marketCap || b.change24h - a.change24h);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ticker.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.contractAddress?.toLowerCase().includes(q) ||
        p.creator?.toLowerCase().includes(q),
    );
  }

  return result;
}

export function ExplorePage() {
  const [category, setCategory] = useState<ExploreCategory>("trending");
  const [query, setQuery] = useState("");
  const factoryConfigured = !!getLaunchFactoryAddress();
  const { data: onChainPools, isLoading } = useLaunches();

  const pools = factoryConfigured ? (onChainPools ?? []) : MOCK_POOLS;

  const filtered = useMemo(
    () => filterPools(pools, category, query),
    [pools, category, query],
  );

  const displayPools = filtered.slice(0, 12);

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn(
                "explore-tab",
                category === id && "explore-tab-active",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && (
                <span className="rounded bg-violet-600 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden min-w-[200px] sm:block">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              type="search"
              placeholder="Search tokens…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field-input h-9 w-full pl-9 text-xs"
            />
          </div>
          <Link
            href="/launch"
            className="hidden items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300 sm:inline-flex"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/launch" className="btn-primary gap-2 !px-4 !py-2 text-xs sm:hidden">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Link>
        </div>
      </div>

      {!factoryConfigured && (
        <p className="mb-4 text-xs text-zinc-600">
          Demo data · on-chain launches at{" "}
          <span className="font-mono text-zinc-500">${TARGET_LAUNCH_MCAP_USD.toLocaleString()}</span> FDV
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {isLoading && factoryConfigured
          ? Array.from({ length: 8 }).map((_, i) => <TokenCardSkeleton key={i} />)
          : displayPools.map((pool) => <TokenCard key={pool.id} pool={pool} />)}
      </div>

      {!isLoading && displayPools.length === 0 && (
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <Sparkles className="mb-4 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No tokens match your filters</p>
          <Link href="/launch" className="btn-primary mt-6 gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Launch a token
          </Link>
        </div>
      )}

      {filtered.length > displayPools.length && (
        <p className="mt-6 text-center text-xs text-zinc-600">
          Showing {displayPools.length} of {filtered.length} pools
        </p>
      )}
    </div>
  );
}

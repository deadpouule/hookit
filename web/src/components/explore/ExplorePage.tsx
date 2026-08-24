"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Sparkles } from "lucide-react";

import { TokenCard } from "@/components/explore/TokenCard";
import { TokenCardSkeleton } from "@/components/explore/TokenCardSkeleton";
import { useLaunches } from "@/hooks/useLaunches";
import { MOCK_POOLS, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { exploreStats } from "@/lib/explore";
import type { ExploreCategory, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { id: ExploreCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "backed-floor", label: "Backed Floor" },
  { id: "anti-snipe", label: "Anti-Snipe" },
  { id: "custom-hooks", label: "Custom" },
  { id: "top-gainers", label: "Top" },
];

function filterPools(pools: TokenPool[], category: ExploreCategory, query: string) {
  let result = [...pools];
  switch (category) {
    case "backed-floor":
      result = result.filter((p) => p.hooks.backedFloor);
      break;
    case "anti-snipe":
      result = result.filter((p) => p.hooks.antiSnipe);
      break;
    case "custom-hooks":
      result = result.filter((p) => p.hooks.customHook);
      break;
    case "top-gainers":
      result.sort((a, b) => b.change24h - a.change24h);
      break;
    default:
      result.sort((a, b) => b.marketCap - a.marketCap);
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ticker.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.contractAddress?.toLowerCase().includes(q),
    );
  }
  return result;
}

export function ExplorePage() {
  const [category, setCategory] = useState<ExploreCategory>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const factoryConfigured = !!getLaunchFactoryAddress();
  const { data: onChainPools, isLoading } = useLaunches();

  const pools = factoryConfigured ? (onChainPools ?? []) : MOCK_POOLS;
  const stats = useMemo(() => exploreStats(pools), [pools]);

  const filtered = useMemo(
    () => filterPools(pools, category, query),
    [pools, category, query],
  );

  const perPage = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Base Sepolia
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Explore hooks
          </h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-500">
            Live Uniswap v4 launches with modular or custom Solidity hooks ·{" "}
            <span className="font-mono text-zinc-400">
              ${TARGET_LAUNCH_MCAP_USD.toLocaleString()}
            </span>{" "}
            launch FDV
          </p>
        </div>

        <Link
          href="/launch"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Create token
        </Link>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live pools" value={stats.totalPools.toString()} />
        <StatCard label="Custom hooks" value={stats.customCount.toString()} />
        <StatCard label="Master hooks" value={stats.masterCount.toString()} />
        <StatCard
          label="Network"
          value={factoryConfigured ? "On-chain" : "Demo"}
          hint={factoryConfigured ? "Base Sepolia" : "Mock data"}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setCategory(f.id);
                setPage(1);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                category === f.id
                  ? "bg-white text-black"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:w-56">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Search name, ticker, address…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="field-input h-10 w-full pl-9"
            />
          </div>

          {filtered.length > perPage && (
            <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-surface px-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center font-mono text-xs text-zinc-400">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && factoryConfigured
          ? Array.from({ length: 6 }).map((_, i) => <TokenCardSkeleton key={i} />)
          : pageItems.map((pool) => <TokenCard key={pool.id} pool={pool} />)}
      </div>

      {!isLoading && pageItems.length === 0 && (
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <Sparkles className="mb-4 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No tokens match your filters</p>
          <p className="mt-1 text-xs text-zinc-600">
            {factoryConfigured
              ? "Be the first to launch with a custom hook"
              : "Connect factory or clear filters"}
          </p>
          <Link
            href="/launch"
            className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Launch a token
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel-inset px-4 py-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

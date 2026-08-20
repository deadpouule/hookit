"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";

import { TokenCard } from "@/components/explore/TokenCard";
import { MOCK_POOLS } from "@/lib/constants";
import type { ExploreCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { id: ExploreCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "backed-floor", label: "Backed Floor" },
  { id: "anti-snipe", label: "Anti-Snipe" },
  { id: "custom-hooks", label: "Custom" },
  { id: "top-gainers", label: "Top" },
];

function filterPools(
  pools: typeof MOCK_POOLS,
  category: ExploreCategory,
  query: string,
) {
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
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.ticker.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q),
    );
  }
  return result;
}

export function ExplorePage() {
  const [category, setCategory] = useState<ExploreCategory>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => filterPools(MOCK_POOLS, category, query),
    [category, query],
  );

  const perPage = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Explore Hooks
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="field-input h-10 w-full pl-9 sm:w-48"
            />
          </div>

          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-surface px-3 text-sm text-zinc-400 transition hover:border-white/15 hover:text-zinc-200"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {category !== "all" && (
              <span className="rounded bg-white/10 px-1.5 text-[10px] text-zinc-300">1</span>
            )}
          </button>

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
              {page} / {totalPages}
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
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setCategory(f.id);
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs transition",
              category === f.id
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((pool) => (
          <TokenCard key={pool.id} pool={pool} />
        ))}
      </div>

      {pageItems.length === 0 && (
        <p className="py-20 text-center text-sm text-zinc-500">No hooks match your search.</p>
      )}
    </div>
  );
}

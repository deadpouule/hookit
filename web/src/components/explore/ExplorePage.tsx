"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Sparkles } from "lucide-react";

import { HookCard } from "@/components/explore/HookCard";
import {
  MASTER_HOOK_FILTERS,
  MASTER_HOOKS,
  type MasterHookCategory,
} from "@/lib/master-hooks";
import { SEARCH_FIELD_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

type HookFilter = "all" | MasterHookCategory;

export function ExplorePage() {
  const [category, setCategory] = useState<HookFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MASTER_HOOKS.filter((hook) => {
      const matchesCategory = category === "all" || hook.category === category;
      const matchesQuery =
        !q ||
        hook.title.toLowerCase().includes(q) ||
        hook.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <div className="market-shell space-y-6 bg-black pt-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-2">
          <h1 className="terminal-title text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Discover one click hooks
          </h1>
          <p className="text-sm text-zinc-400 sm:text-base">
            Browse our Hooks, pick your strategy, and deploy your token in one click
          </p>
        </div>
        <Link
          href="/launch"
          className="launch-coin inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Create token
        </Link>
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
            className="h-11 w-full rounded-xl border border-white/10 bg-[#141416] pr-3 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#9514d1]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-full bg-[#141416] p-1">
          {MASTER_HOOK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setCategory(filter.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                category === filter.id ? "bg-[#2a2a2e] text-white" : "text-zinc-400 hover:text-white",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hook-grid">
        {filtered.map((hook) => (
          <HookCard key={hook.id} hook={hook} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl bg-[#111111] px-6 py-16 text-center">
          <Sparkles className="mb-4 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No master hooks match your filters</p>
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

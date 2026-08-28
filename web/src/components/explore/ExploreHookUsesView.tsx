"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { TokenCard } from "@/components/explore/TokenCard";
import { MasterHookFilterMenu } from "@/components/home/market/MasterHookFilterMenu";
import {
  exploreUsesHref,
} from "@/lib/market-hook-filter";
import {
  MASTER_HOOKS,
  poolsMatchingAnyMasterHooks,
  poolsUsingMasterHook,
  type MasterHook,
  type MasterHookId,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";

export function ExploreHookUsesView({
  hook,
  pools,
  selectedHooks,
}: {
  hook: MasterHook;
  pools: TokenPool[];
  selectedHooks: MasterHookId[];
}) {
  const router = useRouter();

  const matchingPools = useMemo(() => {
    const scoped = poolsUsingMasterHook(pools, hook.id);
    const activeFilters = selectedHooks.length > 0 ? selectedHooks : [hook.id];
    return poolsMatchingAnyMasterHooks(scoped, activeFilters);
  }, [hook.id, pools, selectedHooks]);

  const syncHookFilters = (nextHooks: MasterHookId[]) => {
    router.replace(exploreUsesHref(hook.id, nextHooks), { scroll: false });
  };

  return (
    <div className="market-shell space-y-6 bg-black pt-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to hooks
          </Link>
          <div className="space-y-1">
            <h1 className="terminal-title text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tokens using {hook.title}
            </h1>
            <p className="text-sm text-zinc-400">
              {matchingPools.length} live {matchingPools.length === 1 ? "use" : "uses"} on-chain
            </p>
          </div>
        </div>

        <MasterHookFilterMenu
          active
          selectedHooks={selectedHooks}
          onSelectedHooksChange={syncHookFilters}
          onOpenMasterCategory={() => undefined}
        />
      </div>

      {selectedHooks.length > 0 && (
        <p className="text-xs text-zinc-500">
          Filtered by{" "}
          <span className="text-zinc-300">
            {selectedHooks
              .map((hookId) => MASTER_HOOKS.find((item) => item.id === hookId)?.title ?? hookId)
              .join(", ")}
          </span>
          .{" "}
          <button
            type="button"
            className="text-[#03b1ed] hover:underline"
            onClick={() => syncHookFilters([])}
          >
            Clear hook filters
          </button>
        </p>
      )}

      {matchingPools.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matchingPools.map((pool) => (
            <TokenCard
              key={pool.id}
              pool={pool}
              marketplaceHookFilter={hook.id}
              selectedHookFilters={selectedHooks}
              onHookFilterChange={syncHookFilters}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No tokens match these hook filters yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Try clearing filters or launch with {hook.title}.</p>
        </div>
      )}
    </div>
  );
}

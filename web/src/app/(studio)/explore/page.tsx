import { redirect } from "next/navigation";

import { ExplorePage } from "@/components/explore/ExplorePage";
import { marketplaceHrefForHook, marketplaceHrefForHooks, parseHooksParam } from "@/lib/market-hook-filter";
import { isMasterHookId } from "@/lib/master-hooks";
import { loadLaunchesResponse } from "@/lib/server-launches";
import type { TokenPool } from "@/lib/types";

export const metadata = {
  title: "Hooks | hook it",
  description: "One-click Master hook modules for Uniswap v4 launches on Ink.",
};

export default async function ExploreRoute({
  searchParams,
}: {
  searchParams: Promise<{ uses?: string; hooks?: string }>;
}) {
  const params = await searchParams;
  const usesHook = params.uses;

  if (usesHook && isMasterHookId(usesHook)) {
    const hookFilters = parseHooksParam(params.hooks);
    redirect(
      hookFilters.length > 0
        ? marketplaceHrefForHooks(hookFilters)
        : marketplaceHrefForHook(usesHook),
    );
  }

  let initialPools: TokenPool[] = [];
  try {
    const res = await loadLaunchesResponse();
    initialPools = res.pools ?? [];
  } catch {
    /* client refetch via useLaunches */
  }

  return <ExplorePage initialPools={initialPools} />;
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";

import { TokenDetailView } from "@/components/token/TokenDetailView";
import { useLaunchPool } from "@/hooks/useLaunches";
import { getChainDeployment, isFactoryConfigured } from "@/lib/contracts/config";
import { getDetailPool } from "@/lib/pools";
import { annotateCopyFlags } from "@/lib/token-identity";
import { poolToMarketToken } from "@/lib/market-tokens";
import type { TokenPool } from "@/lib/types";

export function TokenDetailPageClient({
  id,
  initialPool,
}: {
  id: string;
  initialPool?: TokenPool;
}) {
  const factoryConfigured = isFactoryConfigured();
  const network = getChainDeployment().networkLabel;
  const queryClient = useQueryClient();

  const {
    data: onChainPool,
    isPending: poolPending,
    isFetching: poolFetching,
    isError: poolError,
  } = useLaunchPool(id, initialPool);

  const copyFlags = useMemo(() => {
    const listedPools = queryClient.getQueryData<TokenPool[]>(["launches"]);
    if (!listedPools?.length) return { isOriginal: false, isCopycat: false };
    const annotated = annotateCopyFlags(listedPools.map(poolToMarketToken));
    const needle = id.toLowerCase();
    const match = annotated.find((t) => t.id.toLowerCase() === needle);
    return { isOriginal: match?.isOriginal ?? false, isCopycat: match?.isCopycat ?? false };
  }, [queryClient, id]);

  const demoPool = getDetailPool(id);

  const waitingOnChain =
    factoryConfigured &&
    !initialPool &&
    !onChainPool &&
    (poolPending || poolFetching);

  const pool: TokenPool | undefined =
    onChainPool ?? initialPool ?? (!isAddress(id) ? demoPool : undefined) ?? undefined;

  if (waitingOnChain) {
    return (
      <div className="market-shell py-20 text-center text-sm text-zinc-500">
        Loading token from {network}…
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="market-shell py-20 text-center">
        <p className="text-lg font-medium text-white">Token not found</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          {poolError
            ? `Could not load this token from ${network}.`
            : `No launch matches “${id}” on ${network}.`}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-[#9514d1]"
        >
          Back to explore
        </Link>
      </div>
    );
  }

  return (
    <TokenDetailView pool={pool} isOriginal={copyFlags.isOriginal} isCopycat={copyFlags.isCopycat} />
  );
}

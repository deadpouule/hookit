"use client";

import Link from "next/link";
import { useMemo, use } from "react";
import { isAddress } from "viem";
import { usePublicClient } from "wagmi";

import { TokenDetailView } from "@/components/token/TokenDetailView";
import { useLaunchPool, useLaunches } from "@/hooks/useLaunches";
import { getChainDeployment, isFactoryConfigured } from "@/lib/contracts/config";
import { getDetailPool } from "@/lib/pools";
import { annotateCopyFlags } from "@/lib/token-identity";
import { poolToMarketToken } from "@/lib/market-tokens";
import type { TokenPool } from "@/lib/types";

function resolveFromList(pools: TokenPool[] | undefined, id: string): TokenPool | undefined {
  if (!pools?.length) return undefined;
  const needle = id.toLowerCase();
  return pools.find(
    (p) =>
      p.id.toLowerCase() === needle ||
      p.contractAddress?.toLowerCase() === needle ||
      (p.launchId != null && String(p.launchId) === id),
  );
}

export function TokenDetailPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const factoryConfigured = isFactoryConfigured();
  const publicClient = usePublicClient();
  const network = getChainDeployment().networkLabel;

  const {
    data: onChainPool,
    isPending: poolPending,
    isFetching: poolFetching,
    isError: poolError,
  } = useLaunchPool(id);

  const { data: listedPools, isPending: listPending } = useLaunches();

  const copyFlags = useMemo(() => {
    if (!listedPools?.length) return { isOriginal: false, isCopycat: false };
    const annotated = annotateCopyFlags(listedPools.map(poolToMarketToken));
    const needle = id.toLowerCase();
    const match = annotated.find(
      (t) => t.id.toLowerCase() === needle,
    );
    return { isOriginal: match?.isOriginal ?? false, isCopycat: match?.isCopycat ?? false };
  }, [listedPools, id]);

  const waitingOnChain =
    factoryConfigured &&
    (!publicClient || poolPending || poolFetching || (listPending && !onChainPool));

  if (waitingOnChain) {
    return (
      <div className="market-shell py-20 text-center text-sm text-zinc-500">
        Loading token from {network}…
      </div>
    );
  }

  const fromList = resolveFromList(listedPools, id);
  const demoPool = getDetailPool(id);

  // Prefer live chain → marketplace list → demo catalog (slug ids like "smingo").
  const pool: TokenPool | undefined =
    onChainPool ?? fromList ?? (!isAddress(id) ? demoPool : undefined) ?? undefined;

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
          Back to pools
        </Link>
      </div>
    );
  }

  return <TokenDetailView pool={pool} isOriginal={copyFlags.isOriginal} isCopycat={copyFlags.isCopycat} />;
}

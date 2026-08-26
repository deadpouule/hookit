"use client";

import { notFound } from "next/navigation";
import { use } from "react";

import { TokenDetailView } from "@/components/token/TokenDetailView";
import { useLaunchPool } from "@/hooks/useLaunches";
import { getNetworkLabel } from "@/lib/chains";
import { getPoolById } from "@/lib/pools";
import { getLaunchFactoryAddress } from "@/lib/contracts/config";

export function TokenDetailPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const factoryConfigured = !!getLaunchFactoryAddress();
  const { data: onChainPool, isLoading } = useLaunchPool(id);
  const mockPool = !factoryConfigured ? getPoolById(id) : undefined;
  const pool = factoryConfigured ? onChainPool : mockPool;

  if (isLoading && factoryConfigured) {
    return (
      <div className="page-shell py-20 text-center text-sm text-zinc-500">
        Loading token from {getNetworkLabel()}…
      </div>
    );
  }

  if (!pool) notFound();

  return <TokenDetailView pool={pool} />;
}

"use client";

import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { useMemo } from "react";
import { formatUnits } from "viem";
import { useQueries } from "@tanstack/react-query";

import { ConnectButton, useWalletReady } from "@/components/wallet/ConnectButton";
import { useLaunches } from "@/hooks/useLaunches";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { formatCompactUsd } from "@/lib/format";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PortfolioPage() {
  const walletReady = useWalletReady();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: pools, isLoading } = useLaunches();

  const created = useMemo(() => {
    if (!address || !pools) return [];
    const me = address.toLowerCase();
    return pools.filter((p) => p.creator?.toLowerCase() === me);
  }, [address, pools]);

  const balanceQueries = useQueries({
    queries: (pools ?? []).slice(0, 40).map((pool) => ({
      queryKey: ["portfolio-bal", address, pool.contractAddress],
      enabled: !!address && !!publicClient && !!pool.contractAddress,
      staleTime: 20_000,
      queryFn: async () => {
        if (!publicClient || !address || !pool.contractAddress) return null;
        const bal = (await publicClient.readContract({
          address: pool.contractAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (bal <= BigInt(0)) return null;
        return { pool, bal };
      },
    })),
  });

  const holdings = useMemo(() => {
    return balanceQueries
      .map((q) => q.data)
      .filter((row): row is { pool: TokenPool; bal: bigint } => !!row);
  }, [balanceQueries]);

  return (
    <div className="market-shell stats-page">
      <header className="stats-head">
        <div className="stats-title-halo" aria-hidden />
        <h1 className="terminal-title">Portfolio</h1>
        <p className="stats-lede">Your launches and token balances on Hookit.</p>
      </header>

      {!walletReady ? (
        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#111111] px-6 py-16 text-center">
          <p className="mb-4 text-sm text-zinc-400">Connect a wallet to see your portfolio</p>
          <ConnectButton
            label="Connect wallet"
            className="launch-coin rounded-xl px-4 py-2 text-sm font-semibold"
          />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="stats-block">
            <div className="stats-block-head">
              <h2>Created</h2>
              <span className="text-[11px] text-zinc-500">{created.length} tokens</span>
            </div>
            {isLoading && <p className="text-sm text-zinc-500">Loading launches…</p>}
            {!isLoading && created.length === 0 && (
              <p className="text-sm text-zinc-500">
                No launches from this wallet yet.{" "}
                <Link href="/launch" className="text-[#d8b4fe] hover:underline">
                  Create one
                </Link>
              </p>
            )}
            <div className="mt-3 divide-y divide-white/5">
              {created.map((pool) => (
                <PoolRow key={pool.id} pool={pool} />
              ))}
            </div>
          </section>

          <section className="stats-block">
            <div className="stats-block-head">
              <h2>Holdings</h2>
              <span className="text-[11px] text-zinc-500">{holdings.length} with balance</span>
            </div>
            {holdings.length === 0 && (
              <p className="text-sm text-zinc-500">No Hookit token balances detected yet.</p>
            )}
            <div className="mt-3 divide-y divide-white/5">
              {holdings.map(({ pool, bal }) => (
                <PoolRow
                  key={`h-${pool.id}`}
                  pool={pool}
                  balance={formatUnits(bal, 18)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PoolRow({ pool, balance }: { pool: TokenPool; balance?: string }) {
  return (
    <Link
      href={`/token/${pool.id}`}
      className="flex items-center justify-between gap-3 py-3 transition hover:bg-white/[0.02]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">
          {pool.name}{" "}
          <span className="font-mono text-zinc-500">${pool.ticker}</span>
        </p>
        <p className="text-[11px] text-zinc-500">
          {pool.hookType}
          {balance
            ? ` · bal ${Number(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : ""}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-mono text-sm",
            pool.change24h >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {formatCompactUsd(pool.marketCap)}
        </p>
        <p className="text-[11px] text-zinc-600">mcap</p>
      </div>
    </Link>
  );
}

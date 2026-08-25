"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { formatUsd } from "@/lib/format";
import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";

type FloorRow = {
  token: string;
  name: string;
  ticker: string;
  creator?: string;
  reserveEth: number;
  floorPriceEth: number;
};

export function FloorPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["floors"],
    queryFn: async () => {
      const res = await fetch("/api/floor", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load floors");
      return res.json() as Promise<{ floors: FloorRow[]; totalEth: number }>;
    },
    refetchInterval: 15_000,
  });

  const floors = data?.floors ?? [];
  const totalEth = data?.totalEth ?? 0;

  return (
    <>
      <div className="page-shell py-8 sm:py-12">
        <p className="text-xs text-zinc-600">Hookit-native</p>
        <h1 className="ink-headline mt-1 text-3xl sm:text-4xl">
          Backed <span className="text-degen">floor</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          Quote collateral locked in FloorVault. Redeem tokens at the ratchet — P_floor never
          decreases. Swaps stay on Hookit so hook accounting (delta) can fill the floor.
        </p>

        <div className="panel mt-8 grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">ETH in vaults</p>
            <p className="mt-1 font-mono text-2xl text-white">{totalEth.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">USD (spot)</p>
            <p className="mt-1 font-mono text-2xl text-white">
              {formatUsd(totalEth * DEFAULT_LAUNCH_ETH_USD)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          {isLoading && <p className="text-sm text-zinc-500">Loading vaults…</p>}
          {!isLoading && floors.length === 0 && (
            <p className="text-sm text-zinc-500">No backed-floor launches yet.</p>
          )}
          <ul className="space-y-2">
            {floors.map((row) => (
              <li key={row.token}>
                <Link
                  href={`/explore/${row.token}`}
                  className="panel flex items-center justify-between gap-4 p-4 transition hover:border-white/15"
                >
                  <div>
                    <p className="text-sm text-white">{row.name}</p>
                    <p className="font-mono text-xs text-zinc-500">${row.ticker}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-zinc-200">{row.reserveEth.toFixed(5)} ETH</p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      floor {row.floorPriceEth.toExponential(3)} ETH
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

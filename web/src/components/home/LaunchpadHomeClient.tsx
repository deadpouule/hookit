"use client";

import dynamic from "next/dynamic";

import { Marketplace } from "@/components/home/market/Marketplace";
import { SiteHeader } from "@/components/home/market/SiteHeader";
import { StatusBar } from "@/components/home/market/StatusBar";
import type { TokenPool } from "@/lib/types";

const LeanHero = dynamic(
  () => import("@/components/home/market/LeanHero").then((m) => m.LeanHero),
  {
    loading: () => (
      <div
        className="lean-hero min-h-[12rem] animate-pulse rounded-2xl bg-zinc-900/40"
        aria-hidden
      />
    ),
  },
);

export function LaunchpadHomeClient({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background pb-[calc(var(--mobile-chrome-pad)+2.5rem)] md:pb-40">
      <SiteHeader />
      <div className="market-shell space-y-6 pt-4">
        <LeanHero />
        <Marketplace initialPools={initialPools} />
      </div>
      <StatusBar />
    </div>
  );
}

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
        className="lean-hero hidden min-h-[12rem] animate-pulse rounded-2xl bg-zinc-900/40 desk:block"
        aria-hidden
      />
    ),
  },
);

export function LaunchpadHomeClient({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  return (
    <div className="min-h-dvh bg-background pb-40 phone:pb-28">
      <SiteHeader />
      <div className="market-shell space-y-6 pt-4 phone:space-y-4 phone:pt-3">
        <div className="hidden desk:block">
          <LeanHero />
        </div>
        <Marketplace initialPools={initialPools} />
      </div>
      <StatusBar />
    </div>
  );
}

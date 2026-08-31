"use client";

import { LeanHero } from "@/components/home/market/LeanHero";
import { Marketplace } from "@/components/home/market/Marketplace";
import { SiteHeader } from "@/components/home/market/SiteHeader";
import { StatusBar } from "@/components/home/market/StatusBar";
import type { TokenPool } from "@/lib/types";

export function LaunchpadHomeClient({ initialPools = [] }: { initialPools?: TokenPool[] }) {
  return (
    <div className="min-h-screen bg-background pb-40">
      <SiteHeader />
      <div className="market-shell space-y-6 pt-4">
        <LeanHero />
        <Marketplace initialPools={initialPools} />
      </div>
      <StatusBar />
    </div>
  );
}

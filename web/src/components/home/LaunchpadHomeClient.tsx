"use client";

import { LeanHero } from "@/components/home/market/LeanHero";
import { LiveOnInkTicker } from "@/components/home/market/LiveOnInkTicker";
import { Marketplace } from "@/components/home/market/Marketplace";
import { SiteHeader } from "@/components/home/market/SiteHeader";
import { StatusBar } from "@/components/home/market/StatusBar";

export function LaunchpadHomeClient() {
  return (
    <div className="min-h-screen bg-black pb-40">
      <LiveOnInkTicker />
      <SiteHeader />
      <div className="market-shell space-y-6 pt-4">
        <LeanHero />
        <Marketplace />
      </div>
      <StatusBar />
    </div>
  );
}

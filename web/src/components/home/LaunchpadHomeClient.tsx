"use client";

import { useEffect, useState } from "react";

import { HomeNav } from "@/components/home/market/HomeNav";
import { LeanHero } from "@/components/home/market/LeanHero";
import { Marketplace } from "@/components/home/market/Marketplace";
import { StaticDemoShell } from "@/components/home/market/StaticDemoShell";
import { StatusBar } from "@/components/home/market/StatusBar";

export function LaunchpadHomeClient() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <StaticDemoShell />;
  }

  return (
    <div className="min-h-screen bg-black pb-40">
      <HomeNav />
      <div className="market-shell space-y-6 pt-4">
        <LeanHero />
        <Marketplace />
      </div>
      <StatusBar />
    </div>
  );
}

import { HomeNav } from "@/components/home/market/HomeNav";
import { HomeTicker } from "@/components/home/market/HomeTicker";
import { LeanHero } from "@/components/home/market/LeanHero";
import { Marketplace } from "@/components/home/market/Marketplace";
import { StatusBar } from "@/components/home/market/StatusBar";

export function LaunchpadHome() {
  return (
    <div className="min-h-screen bg-black pb-12">
      <HomeTicker />
      <HomeNav />
      <div className="market-shell space-y-6 pt-4">
        <LeanHero />
        <Marketplace />
      </div>
      <StatusBar />
    </div>
  );
}

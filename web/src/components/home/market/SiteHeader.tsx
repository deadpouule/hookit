import { HomeNav } from "@/components/home/market/HomeNav";
import { LiveOnInkTicker } from "@/components/home/market/LiveOnInkTicker";

export function SiteHeader() {
  return (
    <>
      <LiveOnInkTicker />
      <HomeNav />
    </>
  );
}

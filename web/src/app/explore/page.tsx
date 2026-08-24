import { ExplorePage } from "@/components/explore/ExplorePage";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Explore | hook it",
  description: "Explore hooked liquidity on Base Sepolia — Uniswap v4 modular launchpad.",
};

export default function ExploreRoute() {
  return (
    <>
      <ExplorePage />
      <SiteFooter />
    </>
  );
}

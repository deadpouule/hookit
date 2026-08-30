import { LiveOnInkTicker } from "@/components/home/market/LiveOnInkTicker";
import { HookitFunLogo } from "@/components/brand/HookitFunLogo";
import { SiteHeader } from "@/components/home/market/SiteHeader";

function SkeletonCard() {
  return (
    <div className="market-card overflow-hidden border border-white/10 p-3">
      <div className="mb-2 aspect-square animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-white/[0.08]" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
    </div>
  );
}

/** Pre-hydration / loading shell — no demo tokens. */
export function MarketplaceLoadingShell() {
  return (
    <div className="min-h-screen bg-black pb-40">
      <LiveOnInkTicker />
      <SiteHeader />
      <div className="market-shell space-y-6 pt-4">
        <div className="h-40 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.03]" />
        <p className="text-center text-xs text-zinc-500">Loading launches…</p>
        <div className="token-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lightweight shell when only the header is ready (legacy import). */
export function StaticDemoShell() {
  return <MarketplaceLoadingShell />;
}

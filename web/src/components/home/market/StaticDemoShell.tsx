import Link from "next/link";

import { buildDemoMarketTokens } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

/** Zero-hook fallback — renders on the server and first client paint before Web3 hydrates. */
export function StaticDemoShell() {
  const tokens = buildDemoMarketTokens().slice(0, 8);

  return (
    <div className="min-h-screen bg-black pb-12">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black">
        <div className="market-shell flex h-16 items-center justify-between">
          <span className="text-sm font-semibold text-white">hook it</span>
          <Link href="/launch" className="rounded-xl bg-[#9514d1] px-4 py-2 text-sm font-semibold text-white">
            Launch
          </Link>
        </div>
      </header>

      <div className="market-shell space-y-6 pt-6">
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          Loading marketplace… demo preview shown instantly.
        </p>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">Tokens</h2>
          <div className="token-grid">
            {tokens.map((token) => (
              <Link
                key={token.id}
                href={tokenHref(token.id)}
                className="market-card block overflow-hidden border border-white/10 p-3 transition hover:border-[#9514d1]"
              >
                <div
                  className="token-thumb mb-2 flex aspect-square items-center justify-center text-3xl"
                  style={{ background: token.art }}
                >
                  {token.emoji}
                </div>
                <p className="truncate text-sm font-medium text-white">
                  {token.name} <span className="text-zinc-500">${token.ticker}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

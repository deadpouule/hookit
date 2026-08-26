import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "@/components/layout/BrandMark";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { getNetworkSubtitle } from "@/lib/chains";
import { HOOK_MODULE_ACCENTS } from "@/lib/hook-modules";

const FEATURES = [
  {
    title: "One transaction",
    description: "Token mint, v4 pool, and LP lock — no staging, no follow-up txs.",
    accent: HOOK_MODULE_ACCENTS.swapFee,
  },
  {
    title: "Hook builder",
    description: "Click-to-add modules on a buy circuit. Same bitmask the master hook already runs.",
    accent: HOOK_MODULE_ACCENTS.antiMev,
  },
  {
    title: "Custom Solidity",
    description: "We compile your hook, mine CREATE2 flags, and deploy it at launch.",
    accent: HOOK_MODULE_ACCENTS.creatorTax,
  },
  {
    title: "Quote fees",
    description: "1% in ETH via hook delta. Token supply is never taxed.",
    accent: HOOK_MODULE_ACCENTS.backedFloor,
  },
];

export default function HomePage() {
  return (
    <>
      <div className="page-shell relative py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <div className="mb-8 flex items-center gap-3">
              <BrandMark className="flex h-11 w-11 items-center justify-center rounded-2xl" />
              <p className="text-xs text-zinc-500">{getNetworkSubtitle()}</p>
            </div>

            <h1 className="ink-headline text-4xl leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
              Launch a token
              <br />
              <span className="text-degen">with hooks.</span>
            </h1>

            <p className="mt-6 text-base leading-relaxed text-zinc-500">
              Hookit is the venue. Pools settle on Uniswap v4 with quote-only hook
              accounting — fees stay in ETH, LP is locked, floor fills work. Launch FDV is{" "}
              <span className="font-mono text-ink-lavender">
                ${TARGET_LAUNCH_MCAP_USD.toLocaleString()}
              </span>
              . We do not chase Uniswap.org auto-routing.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/launch" className="btn-primary gap-2">
                Create token
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/builder" className="btn-ghost">
                Build a hook
              </Link>
              <Link href="/explore" className="btn-ghost">
                View pools
              </Link>
            </div>

            <div className="mt-8">
              <ConnectButton />
            </div>
          </div>
        </div>

        <div className="mt-24 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ title, description, accent }) => (
            <div
              key={title}
              className="gel-surface gel-surface-active p-5"
              style={{
                boxShadow: `inset 3px 0 0 0 ${accent.color}, 0 0 32px -16px ${accent.glow}`,
              }}
            >
              <h3 className="text-sm font-medium" style={{ color: accent.color }}>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import { ArrowRight, Code2, Layers, Shield, Zap } from "lucide-react";

import { ConnectButton } from "@/components/wallet/ConnectButton";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";

const FEATURES = [
  {
    icon: Zap,
    title: "Atomic launch",
    description: "Token, pool, and liquidity in one transaction on Uniswap v4.",
  },
  {
    icon: Shield,
    title: "Master modules",
    description: "Anti-snipe, backed floor, anti-MEV — configured without writing Solidity.",
  },
  {
    icon: Code2,
    title: "Custom hooks",
    description: "Paste your own v4 hook source. Hookit mines CREATE2 and deploys at launch.",
  },
  {
    icon: Layers,
    title: "Quote-only fees",
    description: "Swap fees taken in ETH — zero sell pressure on your token.",
  },
];

export default function HomePage() {
  return (
    <>
      <div className="page-shell py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-lime" />
            Live on Base Sepolia testnet
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Launch tokens with{" "}
            <span className="chrome-text">programmable hooks</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-500 sm:text-lg">
            Permissionless Uniswap v4 launchpad. Fixed{" "}
            <span className="font-mono text-zinc-300">
              ${TARGET_LAUNCH_MCAP_USD.toLocaleString()}
            </span>{" "}
            FDV, locked LP, and modular or custom hook architecture.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/launch"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 sm:w-auto"
            >
              Create token
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 text-sm text-zinc-200 transition hover:bg-white/5 sm:w-auto"
            >
              Explore pools
            </Link>
          </div>

          <div className="mt-8 flex justify-center">
            <ConnectButton />
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="panel p-5 transition hover:border-white/[0.14]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                <Icon className="h-4 w-4 text-zinc-300" />
              </div>
              <h3 className="text-sm font-medium text-white">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

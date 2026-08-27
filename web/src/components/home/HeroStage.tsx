"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { HookTile } from "@/components/hooks/HookMark";
import { useLaunches } from "@/hooks/useLaunches";
import { getNetworkLabel } from "@/lib/chains";
import { MOCK_POOLS, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { isFactoryConfigured } from "@/lib/contracts/config";
import { SHOWCASE_HOOK_IDS } from "@/lib/hook-marks";
import { formatUsd } from "@/lib/format";
import { tokenHref } from "@/lib/routes";
import type { TokenPool } from "@/lib/types";

function StageLeaders() {
  const factoryConfigured = isFactoryConfigured();
  const { data } = useLaunches();
  const pools = (factoryConfigured ? (data ?? []) : MOCK_POOLS).slice(0, 3);

  return (
    <div className="flex w-full flex-col gap-2 sm:max-w-[260px]">
      <p className="text-[11px] font-medium tracking-[0.16em] text-black/55 uppercase">
        Live launches
      </p>
      {pools.length === 0
        ? [0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-black/15" />
          ))
        : pools.map((pool) => <LeaderRow key={pool.id} pool={pool} />)}
    </div>
  );
}

function LeaderRow({ pool }: { pool: TokenPool }) {
  return (
    <Link
      href={tokenHref(pool.id)}
      className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2 backdrop-blur-md transition hover:bg-black/30"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white/90"
        style={{ background: pool.bannerGradient }}
      >
        {pool.ticker[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black">{pool.name}</span>
        <span className="font-mono text-[10px] text-black/55">${pool.ticker}</span>
      </span>
      <span className="font-mono text-[11px] text-black/70">{formatUsd(pool.marketCap || TARGET_LAUNCH_MCAP_USD)}</span>
    </Link>
  );
}

export function HeroStage() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10">
      <div className="stage-caustics absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/20" />

      <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1.2fr_auto] lg:items-center">
        <div className="max-w-xl">
          <motion.div
            className="chrome-emblem mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
              <path
                d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
                fill="#1a1a1f"
                stroke="#3f3f46"
                strokeWidth="0.75"
              />
              <path d="M12 11v6M9.5 17h5" stroke="#52525b" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
          </motion.div>

          <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-black/60 uppercase">
            Uniswap v4 · {getNetworkLabel()}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl">
            Launch with programmable hooks
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-black/70 sm:text-base">
            Atomic token + pool. Locked LP. Quote-only fees. Mix master modules or drop your own
            Solidity — ${TARGET_LAUNCH_MCAP_USD.toLocaleString()} FDV from block zero.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/launch"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Launch a token
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white/30 px-5 py-2.5 text-sm font-medium text-black backdrop-blur-md transition hover:bg-white/50"
            >
              Explore pools
            </Link>
          </div>
        </div>

        <StageLeaders />
      </div>
    </section>
  );
}

export function HookShowcase() {
  return (
    <div className="panel overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
            Hook marketplace
          </p>
          <h2 className="mt-1 text-xl font-medium text-white">Five rules. One pool.</h2>
          <p className="mt-1 max-w-lg text-sm text-zinc-500">
            Each module has its own mark. Combine them on the master hook, or ship custom Solidity.
          </p>
        </div>
        <Link href="/launch" className="text-sm text-zinc-400 transition hover:text-white">
          Build a hook →
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {SHOWCASE_HOOK_IDS.map((id) => (
          <HookTile key={id} id={id} />
        ))}
      </div>
    </div>
  );
}

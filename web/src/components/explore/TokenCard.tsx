"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Copy, Globe } from "lucide-react";

import { formatUsd } from "@/lib/format";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TokenCardProps {
  pool: TokenPool;
}

export function TokenCard({ pool }: TokenCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={`/explore/${pool.id}`}
        className="group panel block overflow-hidden transition hover:border-white/[0.14]"
      >
        <div className="card-banner" style={{ background: pool.bannerGradient }}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-30 transition group-hover:opacity-50">
            <span className="text-5xl font-bold text-white/80">{pool.ticker[0]}</span>
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[15px] font-medium text-zinc-100">{pool.name}</h3>
            <span className="shrink-0 font-mono text-sm text-zinc-500">${pool.ticker}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Market cap{" "}
            <span className="font-mono text-sm text-zinc-300">{formatUsd(pool.marketCap)}</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                pool.hookType === "Custom"
                  ? "border-amber-500/30 text-amber-400/90"
                  : "border-white/10 text-zinc-500",
              )}
            >
              {pool.hookType}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
              {pool.address}
              <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-600">
            <Globe className="h-3.5 w-3.5 transition group-hover:text-zinc-300" />
            <span className="text-[10px] font-medium transition group-hover:text-zinc-300">𝕏</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

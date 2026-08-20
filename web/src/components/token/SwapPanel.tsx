"use client";

import { useState } from "react";

import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

type SwapSide = "buy" | "sell";

interface SwapPanelProps {
  pool: TokenPool;
}

export function SwapPanel({ pool }: SwapPanelProps) {
  const [side, setSide] = useState<SwapSide>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");

  const assetLabel = pool.quoteAsset ?? "ETH";
  const inputLabel = side === "buy" ? "You pay" : "You sell";

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex rounded-xl border border-white/[0.08] bg-black/40 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm capitalize transition",
              side === s
                ? "border border-white/15 bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-zinc-500">{inputLabel}</span>
          <span className="text-zinc-600">Connect to view balance</span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/50 px-4 py-4">
          <input
            type="number"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-3xl text-white outline-none placeholder:text-zinc-700"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Max
            </button>
            <span className="font-mono text-sm text-zinc-400">
              {side === "buy" ? assetLabel : pool.ticker}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-xs">
          <span className="text-zinc-500">Pool fee </span>
          <span className="font-mono text-zinc-300">1%</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-xs">
          <span className="text-zinc-500">Max slippage</span>
          <input
            type="text"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="w-8 bg-transparent text-right font-mono text-zinc-300 outline-none"
          />
          <span className="text-zinc-500">%</span>
        </div>
      </div>

      {pool.hooks.backedFloor && (
        <p className="mt-3 text-[11px] text-emerald-500/70">
          Backed floor active · fees quote-only
        </p>
      )}
      {pool.hooks.antiSnipe && (
        <p className="mt-1 text-[11px] text-amber-500/70">Anti-snipe tax may apply on buys</p>
      )}

      <button
        type="button"
        className="mt-6 w-full rounded-xl bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200"
      >
        Connect wallet
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";

import { ConnectButton, useWalletReady } from "@/components/wallet/ConnectButton";
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
  const walletReady = useWalletReady();

  const assetLabel = pool.quoteAsset ?? "ETH";
  const inputLabel = side === "buy" ? "You pay" : "You sell";

  return (
    <div className="panel p-5 sm:p-6">
      <p className="mb-4 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        Swap
      </p>

      <div className="flex rounded-xl border border-white/[0.08] bg-black/40 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition",
              side === s ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-zinc-500">{inputLabel}</span>
          <span className="text-zinc-600">
            {walletReady ? "Balance: —" : "Connect wallet"}
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/50 px-4 py-4">
          <input
            type="number"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!walletReady}
            className="min-w-0 flex-1 bg-transparent font-mono text-3xl text-white outline-none placeholder:text-zinc-700 disabled:opacity-50"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!walletReady}
              className="text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-40"
            >
              Max
            </button>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300">
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
          <span className="text-zinc-500">Slippage</span>
          <input
            type="text"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            disabled={!walletReady}
            className="w-8 bg-transparent text-right font-mono text-zinc-300 outline-none disabled:opacity-50"
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
      {pool.hooks.customHook && (
        <p className="mt-1 text-[11px] text-amber-300/70">Custom Solidity hook pool</p>
      )}

      {walletReady ? (
        <button
          type="button"
          disabled
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm text-zinc-400"
        >
          Swap router coming soon
        </button>
      ) : (
        <div className="mt-6 space-y-2">
          <ConnectButton className="w-full justify-center py-2.5" />
          <p className="text-center text-[11px] text-zinc-600">
            Connect on Base Sepolia to swap
          </p>
        </div>
      )}
    </div>
  );
}

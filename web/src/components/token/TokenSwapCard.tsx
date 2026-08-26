"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { TokenProSwap } from "@/components/token/TokenProSwap";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { QUICK_BUY_AMOUNTS } from "@/lib/market-tokens";
import { cn } from "@/lib/utils";

type Mode = "pro" | "instant";
type Side = "buy" | "sell";

export function TokenSwapCard({ ticker }: { ticker: string }) {
  const [mode, setMode] = useState<Mode>("instant");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [payWith, setPayWith] = useState("ETH");
  const [preset, setPreset] = useState<number | null>(null);

  return (
    <div className="desk-card p-4">
      <div className="flex items-center gap-4 text-sm">
        {(["pro", "instant"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "relative pb-1 font-medium capitalize transition",
              mode === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {id}
            {mode === id && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#9514d1]" />}
          </button>
        ))}
      </div>

      {mode === "pro" ? (
        <TokenProSwap ticker={ticker} />
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4 text-sm">
            {(["buy", "sell"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSide(id)}
                className={cn(
                  "relative pb-1 font-medium capitalize transition",
                  side === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {id}
                {side === id && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#9514d1]" />}
              </button>
            ))}
          </div>

          <dl className="mt-4 space-y-1.5 text-[13px]">
            <Row label="Balance" value="—" />
            <Row label="Value" value="—" />
            <Row label="PnL" value="—" />
          </dl>

          <label className="mt-4 block">
            <span className="text-[12px] text-zinc-500">Amount</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 focus-within:border-[#9514d1]/60">
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPreset(null);
                }}
                placeholder="0.0"
                className="min-w-0 flex-1 bg-transparent font-mono text-lg text-white outline-none placeholder:text-zinc-600"
              />
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200">
                {side === "buy" ? payWith : ticker}
                <ChevronDown className="h-3 w-3 text-zinc-500" />
              </span>
            </div>
          </label>

          <div className="mt-3 flex gap-1.5">
            {QUICK_BUY_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAmount(String(value));
                  setPreset(value);
                }}
                className={cn(
                  "flex-1 rounded-lg border py-1.5 font-mono text-[11px] font-semibold transition-all duration-300",
                  preset === value
                    ? "border-[#9514d1] bg-[#9514d1] text-white shadow-[0_0_15px_rgba(149,20,209,0.5)]"
                    : "border-transparent bg-[#2a2a2e] text-zinc-300 hover:border-[#9514d1] hover:text-white hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]",
                )}
              >
                [${value}]
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between text-[12px] text-zinc-500">
            Pay with
            <select
              value={payWith}
              onChange={(e) => setPayWith(e.target.value)}
              className="rounded-md border border-white/10 bg-[#1a1a1c] px-2 py-1 text-xs text-zinc-200 outline-none"
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
            </select>
          </label>
        </>
      )}

      {/* Swap router / Permit2 attach here once LaunchFactory is live. */}
      <ConnectButton
        label="Connect to trade"
        className="launch-coin mt-4 flex w-full justify-center rounded-xl py-3 text-sm font-semibold"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-300">{value}</dd>
    </div>
  );
}

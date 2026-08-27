"use client";

import { formatEther } from "viem";

import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Classic bonding progress toward `graduationQuote` (4.2 ETH-equiv). */
export function BondingProgress({ pool }: { pool: TokenPool }) {
  if (pool.rail !== "classic") return null;

  const real = BigInt(pool.realQuote ?? "0");
  const goal = BigInt(pool.graduationQuote ?? "0");
  const graduated = pool.bondingPhase !== 0;
  const pct =
    graduated || goal === BigInt(0)
      ? 100
      : Math.min(99, Math.round(Number((real * BigInt(100)) / goal)));

  const quoteLabel = pool.quoteAsset ?? "ETH";
  const realFmt = Number(formatEther(real)).toFixed(4);
  const goalFmt = goal > BigInt(0) ? Number(formatEther(goal)).toFixed(2) : "—";

  return (
    <div className="desk-card space-y-2 p-4">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-zinc-500">{graduated ? "Graduated" : "Bonding progress"}</span>
        <span className={cn("font-mono", graduated ? "text-[#10b981]" : "text-zinc-200")}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full", graduated ? "bg-[#10b981]" : "bg-[#9514d1]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-mono text-[11px] text-zinc-500">
        {realFmt} / {goalFmt} {quoteLabel}
        {!graduated && " · graduates at 4.2 ETH-equiv"}
      </p>
    </div>
  );
}

"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { formatAge, formatCompactUsd, formatTokenAmount } from "@/lib/format";
import type { LiveHolder, LiveSwap } from "@/lib/token-live";
import { cn } from "@/lib/utils";

export function TokenTxTable({
  tab,
  onTab,
  swaps,
  holders,
  ticker,
}: {
  tab: "swaps" | "holders";
  onTab: (next: "swaps" | "holders") => void;
  swaps: LiveSwap[];
  holders: LiveHolder[];
  ticker: string;
}) {
  return (
    <div className="desk-card overflow-hidden">
      <div className="flex items-center gap-5 border-b border-white/10 px-4">
        {(["swaps", "holders"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn(
              "relative py-3 text-sm font-medium capitalize transition",
              tab === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {id}
            {tab === id && (
              <span className="absolute inset-x-0 bottom-0 h-px bg-[#9514d1]" />
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {tab === "swaps" ? (
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-zinc-500 uppercase">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Total USD</th>
                <th className="px-4 py-2.5 font-medium">Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {swaps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No on-chain swaps yet
                  </td>
                </tr>
              ) : (
                swaps.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-400">{formatAge(row.ageSec)}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-300">{row.recipient}</td>
                  <td
                    className="px-4 py-2.5 font-medium"
                    style={{ color: row.side === "buy" ? "#10b981" : "#ef4444" }}
                  >
                    {row.side === "buy" ? "Buy" : "Sell"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-200">
                    {formatTokenAmount(row.amount)} {ticker}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-200">
                    {formatCompactUsd(row.totalUsd)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-200">
                      {formatCompactUsd(row.marketCap)}
                      {row.side === "buy" ? (
                        <TrendingUp className="h-3 w-3 text-[#10b981]" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-[#ef4444]" />
                      )}
                    </span>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-zinc-500 uppercase">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2.5 font-medium">Holder</th>
                <th className="px-4 py-2.5 font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Supply</th>
              </tr>
            </thead>
            <tbody>
              {holders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Holders appear once the indexer has caught up
                  </td>
                </tr>
              ) : (
                holders.map((row) => (
                <tr
                  key={row.address}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-300">{row.address}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-200">
                    {formatTokenAmount(row.balance)} {ticker}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-200">{row.pct.toFixed(2)}%</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

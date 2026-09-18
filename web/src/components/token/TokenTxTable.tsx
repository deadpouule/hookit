"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatAge, formatCompactUsd, formatTokenAmount } from "@/lib/format";
import type { LiveHolder, LiveSwap } from "@/lib/token-live";
import { cn } from "@/lib/utils";

function explorerTxUrl(hash?: string) {
  return hash && /^0x[a-fA-F0-9]{64}$/.test(hash) ? `${BLOCK_EXPLORER_URL}/tx/${hash}` : null;
}

function explorerAddressUrl(address?: string) {
  return address && /^0x[a-fA-F0-9]{40}$/.test(address)
    ? `${BLOCK_EXPLORER_URL}/address/${address}`
    : null;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function ExplorerCell({
  href,
  children,
  className,
}: {
  href: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        className,
        "token-tx-link underline decoration-[#9514d1]/45 underline-offset-2 transition hover:text-[#d8b4fe] hover:decoration-[#9514d1]",
      )}
    >
      {children}
    </a>
  );
}

export function TokenTxTable({
  tab,
  onTab,
  swaps,
  holders,
  ticker,
  className,
}: {
  tab: "swaps" | "holders";
  onTab: (next: "swaps" | "holders") => void;
  swaps: LiveSwap[];
  holders: LiveHolder[];
  ticker: string;
  className?: string;
}) {
  return (
    <div className={cn("desk-card overflow-hidden", className)}>
      <div className="flex items-center gap-5 border-b border-white/10 px-4">
        {(["swaps", "holders"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn("token-tx-tab", tab === id && "is-active")}
          >
            {id}
            {tab === id && (
              <span className="absolute inset-x-0 bottom-0 h-px bg-[#9514d1]" />
            )}
          </button>
        ))}
      </div>

      <div className="token-tx-body overflow-x-auto no-scrollbar">
        {tab === "swaps" ? (
          <table className="token-tx-table token-tx-table--swaps w-full min-w-[820px] text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-zinc-500 uppercase">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="token-tx-col-wide px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Total USD</th>
                <th className="token-tx-col-wide px-4 py-2.5 font-medium">FDV</th>
                <th className="token-tx-col-wide px-4 py-2.5 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {swaps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
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
                  <td className="token-tx-col-wide px-4 py-2.5 font-mono text-zinc-300">
                    <ExplorerCell href={explorerAddressUrl(row.recipientAddress)}>
                      {row.recipient}
                    </ExplorerCell>
                  </td>
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
                  <td className="token-tx-col-wide px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-200">
                      {formatCompactUsd(row.marketCap)}
                      {row.side === "buy" ? (
                        <TrendingUp className="h-3 w-3 text-[#10b981]" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-[#ef4444]" />
                      )}
                    </span>
                  </td>
                  <td className="token-tx-col-wide px-4 py-2.5 font-mono text-zinc-300">
                    <ExplorerCell href={explorerTxUrl(row.txHash)}>
                      {row.txHash ? shortHash(row.txHash) : "·"}
                    </ExplorerCell>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="token-tx-table token-tx-table--holders w-full min-w-[520px] text-left text-[13px]">
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
                  key={row.holderAddress ?? row.address}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-300">
                    <ExplorerCell href={explorerAddressUrl(row.holderAddress)}>
                      {row.address}
                    </ExplorerCell>
                  </td>
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

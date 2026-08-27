"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { formatCompactUsd, formatPercent } from "@/lib/format";
import type { LiveTokenState } from "@/lib/token-live";
import { cn } from "@/lib/utils";

const BLOCKSCOUT = "https://base-sepolia.blockscout.com";

export function TokenSidebarStats({
  live,
  contractAddress,
}: {
  live: LiveTokenState;
  contractAddress: string;
}) {
  return (
    <>
      <div className="desk-card p-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Change label="5m" value={live.change5m} />
          <Change label="1h" value={live.change1h} />
          <Change label="6h" value={live.change6h} />
          <Change label="24h" value={live.change24h} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-zinc-500">Txns</p>
            <p className="mt-0.5 font-mono text-white">{live.txns.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-zinc-500">Volume</p>
            <p className="mt-0.5 font-mono text-white">{formatCompactUsd(live.volume24h)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-[#10b981]">Buys {live.buyPct.toFixed(1)}%</span>
            <span className="text-[#ef4444]">Sells {(100 - live.buyPct).toFixed(1)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full">
            <div className="bg-[#10b981]" style={{ width: `${live.buyPct}%` }} />
            <div className="bg-[#ef4444]" style={{ width: `${100 - live.buyPct}%` }} />
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-[13px]">
          <Meta label="Created" value="13 hours ago" />
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Chain</dt>
            <dd className="inline-flex items-center gap-1 text-[#10b981]">
              Base Sepolia
              <Check className="h-3.5 w-3.5" />
            </dd>
          </div>
          <CopyMeta label="CA" value={contractAddress} />
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Dev buy</dt>
            <dd className="rounded-full bg-[#10b981]/15 px-2 py-0.5 text-[11px] font-medium text-[#10b981]">
              Completed
            </dd>
          </div>
        </dl>
      </div>

      <div className="desk-card px-4 py-5 text-[13px] text-zinc-500">
        Sign in with wallet to see your resting orders.
      </div>

      <div className="desk-card p-4">
        <p className="text-[11px] tracking-wide text-zinc-500 uppercase">Links</p>
        <a
          href={`${BLOCKSCOUT}/address/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-[#03b1ed]"
        >
          Blockscout
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </>
  );
}

function Change({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[12px] font-medium",
          value >= 0 ? "text-[#10b981]" : "text-[#ef4444]",
        )}
      >
        {formatPercent(value, true)}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-200">{value}</dd>
    </div>
  );
}

function CopyMeta({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${value.slice(0, 6)}...${value.slice(-4)}`;

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd>
        <button
          type="button"
          onClick={async () => {
            if (!(await copyToClipboard(value))) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          className="inline-flex items-center gap-1 font-mono text-zinc-300 transition hover:text-white"
        >
          {short}
          {copied ? <Check className="h-3 w-3 text-[#10b981]" /> : <Copy className="h-3 w-3 opacity-60" />}
        </button>
      </dd>
    </div>
  );
}

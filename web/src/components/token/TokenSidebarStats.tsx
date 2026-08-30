"use client";

import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { zeroAddress } from "viem";

import { useTokenStats } from "@/hooks/useTokenStats";
import { copyToClipboard } from "@/lib/clipboard";
import {
  formatAge,
  formatCompactUsd,
  formatPercent,
  isValidLaunchTimestamp,
} from "@/lib/format";
import { shortAddress } from "@/lib/master-hooks";
import { formatDevBuyQuote, formatDevBuyTokens } from "@/lib/token-dev-buy";
import type { LiveTokenState } from "@/lib/token-live";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TokenSidebarStats({
  live,
  pool,
  contractAddress,
}: {
  live: LiveTokenState;
  pool: TokenPool;
  contractAddress: string;
}) {
  const { data: stats } = useTokenStats(pool);
  const ageSeconds =
    pool.launchedAt != null && isValidLaunchTimestamp(pool.launchedAt)
      ? Math.max(1, Math.floor(Date.now() / 1000 - pool.launchedAt))
      : null;

  const txns = stats?.txns ?? live.txns;
  const volume24h = stats?.volume24hUsd ?? live.volume24h;
  const buyCount = stats?.buyCount ?? 0;
  const sellCount = stats?.sellCount ?? 0;
  const buyVol = stats?.buyVolumeUsd ?? 0;
  const sellVol = stats?.sellVolumeUsd ?? 0;
  const buyPct = stats?.buyPct ?? live.buyPct;
  const sellPct = 100 - buyPct;

  const changes = [
    { label: "5m", value: stats?.change5m ?? live.change5m },
    { label: "1h", value: stats?.change1h ?? live.change1h },
    { label: "6h", value: stats?.change6h ?? live.change6h },
    { label: "24h", value: stats?.change24h ?? live.change24h },
  ];

  const quoteLabel = pool.quoteAsset ?? "ETH";
  const isEthQuote =
    !pool.quoteAddress || pool.quoteAddress === zeroAddress || quoteLabel === "ETH";
  const quoteDecimals = stats?.quoteDecimals ?? (isEthQuote ? 18 : 6);
  const devBuy = stats?.devBuy ?? { completed: false };

  const buyVolPct = buyVol + sellVol > 0 ? (buyVol / (buyVol + sellVol)) * 100 : buyPct;
  const sellVolPct = 100 - buyVolPct;

  return (
    <div className="desk-card token-stats-card p-4">
      <h3 className="token-stats-card__title">Stats</h3>

      <div className="token-stats-changes">
        {changes.map(({ label, value }) => (
          <ChangeChip key={label} label={label} value={value} active={label === "24h"} />
        ))}
      </div>

      <dl className="token-stats-meta">
        <MetaRow label="Txns" value={txns.toLocaleString()} />
        <MetaRow label="Vol." value={formatCompactUsd(volume24h)} />
      </dl>

      <div className="token-stats-flow">
        <div className="token-stats-flow__labels">
          <span className="text-[#10b981]">{buyCount} buys</span>
          <span className="text-[#ef4444]">{sellCount} sells</span>
        </div>
        <div className="token-stats-flow__bar">
          <div className="bg-[#10b981]" style={{ width: `${buyPct}%` }} />
          <div className="bg-[#ef4444]" style={{ width: `${sellPct}%` }} />
        </div>
        <div className="token-stats-flow__detail">
          <span>
            {buyCount} · {formatCompactUsd(buyVol)} · {buyVolPct.toFixed(1)}%
          </span>
          <span>
            {sellCount} · {formatCompactUsd(sellVol)} · {sellVolPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <dl className="token-stats-meta token-stats-meta--spaced">
        <MetaRow label="Created" value={ageSeconds != null ? `${formatAge(ageSeconds)} ago` : "—"} />
        <div className="token-stats-meta__row">
          <dt>Chain</dt>
          <dd className="token-stats-chain">
            <Image src="/brand/ink-badge.png" alt="" width={16} height={16} className="h-4 w-4 rounded-sm" />
            Ink
          </dd>
        </div>
        <CopyMeta label="CA" value={contractAddress} />
      </dl>

      <div className="token-stats-devbuy">
        <div className="token-stats-meta__row">
          <span className="text-zinc-500">Dev buy</span>
          {devBuy.completed ? (
            <span className="token-stats-devbuy__badge">Completed</span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </div>
        {devBuy.completed && devBuy.quoteSpent && devBuy.tokensReceived && (
          <>
            <MetaRow
              label="Spent"
              value={formatDevBuyQuote(devBuy.quoteSpent, quoteDecimals, isEthQuote ? "ETH" : quoteLabel)}
            />
            <MetaRow
              label="Received"
              value={formatDevBuyTokens(devBuy.tokensReceived, 18, pool.ticker)}
            />
          </>
        )}
        {!devBuy.completed && (
          <p className="token-stats-devbuy__hint">No on-chain buy from creator wallet yet</p>
        )}
      </div>
    </div>
  );
}

function ChangeChip({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div className={cn("token-stats-change", active && "token-stats-change--active")}>
      <span className="token-stats-change__label">{label}</span>
      <span
        className={cn(
          "token-stats-change__value",
          value >= 0 ? "text-[#10b981]" : "text-[#ef4444]",
        )}
      >
        {formatPercent(value, true)}
      </span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="token-stats-meta__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CopyMeta({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const short = shortAddress(value);

  return (
    <div className="token-stats-meta__row">
      <dt>{label}</dt>
      <dd>
        <button
          type="button"
          onClick={async () => {
            if (!(await copyToClipboard(value))) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          className="inline-flex items-center gap-1.5 font-mono text-zinc-300 transition hover:text-white"
        >
          {short}
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[#10b981]" />
          ) : (
            <Copy className="h-3.5 w-3.5 opacity-60" />
          )}
        </button>
      </dd>
    </div>
  );
}

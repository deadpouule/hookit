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
import type { StatsWindow } from "@/lib/token-window-stats";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHANGE_WINDOWS: { key: StatsWindow; label: string; changeKey: "change5m" | "change1h" | "change6h" | "change24h" }[] = [
  { key: "5m", label: "5m", changeKey: "change5m" },
  { key: "1h", label: "1h", changeKey: "change1h" },
  { key: "6h", label: "6h", changeKey: "change6h" },
  { key: "24h", label: "24h", changeKey: "change24h" },
];

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
  const [window, setWindow] = useState<StatsWindow>("24h");

  const ageSeconds =
    pool.launchedAt != null && isValidLaunchTimestamp(pool.launchedAt)
      ? Math.max(1, Math.floor(Date.now() / 1000 - pool.launchedAt))
      : null;

  const windowStats = stats?.windows[window];
  const txns = windowStats?.txns ?? (window === "24h" ? live.txns : 0);
  const volume = windowStats?.volumeUsd ?? (window === "24h" ? live.volume24h : 0);
  const buyCount = windowStats?.buyCount ?? 0;
  const sellCount = windowStats?.sellCount ?? 0;
  const buyVol = windowStats?.buyVolumeUsd ?? 0;
  const sellVol = windowStats?.sellVolumeUsd ?? 0;
  const buyPct = windowStats?.buyPct ?? (window === "24h" ? live.buyPct : 50);
  const sellPct = 100 - buyPct;

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
        {CHANGE_WINDOWS.map(({ key, label, changeKey }) => {
          const value =
            stats?.[changeKey] ??
            (key === "5m"
              ? live.change5m
              : key === "1h"
                ? live.change1h
                : key === "6h"
                  ? live.change6h
                  : live.change24h);
          return (
            <ChangeChip
              key={key}
              label={label}
              value={value}
              active={window === key}
              onClick={() => setWindow(key)}
            />
          );
        })}
      </div>

      <dl className="token-stats-meta">
        <MetaRow label="Txns" value={txns.toLocaleString()} />
        <MetaRow label="Vol." value={formatCompactUsd(volume)} />
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
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "token-stats-change",
        active && "token-stats-change--active",
      )}
    >
      <span className="token-stats-change__label">{label}</span>
      <span
        className={cn(
          "token-stats-change__value",
          value >= 0 ? "text-[#10b981]" : "text-[#ef4444]",
        )}
      >
        {formatPercent(value, true)}
      </span>
    </button>
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

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { changeTone, formatCompactCount, formatTickerUsd } from "@/lib/format";
import type { LiveTokenState } from "@/lib/token-live";
import { formatTvPrice } from "@/lib/tv-chart";
import { cn } from "@/lib/utils";

function formatTickerPct(value: number): string | null {
  const tone = changeTone(value);
  if (tone === "flat") return null;
  const abs = Math.abs(value);
  const body = abs >= 100 ? abs.toFixed(1) : abs.toFixed(2);
  return `${tone === "up" ? "▲" : "▼"} ${body}%`;
}

function FlashValue({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value) || value === prev.current) return;
    setDir(value > prev.current ? "up" : "down");
    prev.current = value;
    const id = window.setTimeout(() => setDir(null), 640);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <span className={cn("token-live-tick-value", dir && `is-${dir}`)}>{children}</span>
  );
}

function Tick({
  label,
  value,
  display,
  pct,
}: {
  label: string;
  value: number;
  display: string;
  pct?: number;
}) {
  const change = pct != null ? formatTickerPct(pct) : null;
  const tone = pct != null ? changeTone(pct) : "flat";

  return (
    <div className="token-live-tick">
      <dt>{label}</dt>
      <dd>
        <FlashValue value={value}>{display}</FlashValue>
        {change ? (
          <span
            className={cn(
              "token-live-tick-chg",
              tone === "up" && "is-up",
              tone === "down" && "is-down",
            )}
          >
            {change}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function TokenLiveTicker({
  live,
  loading,
}: {
  live: LiveTokenState;
  loading?: boolean;
}) {
  const price = live.priceUsd > 0 ? live.priceUsd : 0;
  const priceLabel = loading && !(price > 0) ? "·" : `$${formatTvPrice(price)}`;

  return (
    <dl className="token-live-ticker" aria-label="Live token stats">
      <Tick
        label="FDV"
        value={live.marketCap}
        display={formatTickerUsd(live.marketCap)}
        pct={live.change24h}
      />
      <Tick label="Price" value={price} display={priceLabel} pct={live.change24h} />
      <Tick label="24H Vol" value={live.volume24h} display={formatTickerUsd(live.volume24h)} />
      <Tick label="Liquidity" value={live.liquidity} display={formatTickerUsd(live.liquidity)} />
      <Tick
        label="Holders"
        value={live.holders}
        display={formatCompactCount(live.holders)}
      />
    </dl>
  );
}

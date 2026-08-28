"use client";

import { AnimatedGridBackground } from "@/components/home/market/AnimatedGridBackground";
import { formatCompactUsd } from "@/lib/format";
import type { LiveProtocolKpis } from "@/lib/live-protocol-stats";

function formatVolumeEth(eth: number) {
  if (eth >= 1000) return `${eth.toFixed(3)} ETH`;
  if (eth >= 1) return `${eth.toFixed(3)} ETH`;
  return `${eth.toFixed(4)} ETH`;
}

export function StatsHoloBanner({ live }: { live: LiveProtocolKpis }) {
  const coinsLaunched = live.launches;
  const graduated = live.graduated;
  const volumeEth = live.volume24hEth;
  const volumeUsd = live.volume24hUsd;
  const trades = live.trades24h;

  return (
    <section className="stats-holo-banner" aria-label="Protocol stats">
      <div className="stats-holo-banner__fx stats-holo-banner__caustics lean-caustics" aria-hidden />
      <div className="stats-holo-banner__fx stats-holo-banner__shine lean-shine" aria-hidden />
      <AnimatedGridBackground className="stats-holo-banner__grid hero-grid" />
      <div className="stats-holo-banner__scrim" aria-hidden />

      <div className="stats-holo-banner__content">
        <StatCell value={String(coinsLaunched)} label="coins launched" />
        <StatCell value={String(graduated)} label="graduated" />
        <StatCell
          value={formatVolumeEth(volumeEth)}
          label={`volume · ${formatCompactUsd(volumeUsd).toLowerCase()}`}
        />
        <StatCell value={String(trades)} label="trades" />
      </div>
    </section>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="stats-holo-stat">
      <p className="stats-holo-stat__value">{value}</p>
      <p className="stats-holo-stat__label">{label}</p>
    </div>
  );
}

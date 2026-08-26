"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { BASE_SEPOLIA_EXPLORER } from "@/lib/contracts/config";
import { formatCompactUsd, formatTokenAmount } from "@/lib/format";
import { launchWithHookHref, MASTER_HOOKS } from "@/lib/master-hooks";
import {
  BURN_SERIES,
  BURN_TXS,
  protocolOverview,
  type StatsChartPoint,
} from "@/lib/protocol-stats";

const W = 800;
const H = 268;
const PAD = { top: 16, right: 12, bottom: 32, left: 54 };

function xAt(i: number, n: number) {
  return PAD.left + (i / Math.max(n - 1, 1)) * (W - PAD.left - PAD.right);
}

function yAt(value: number, min: number, max: number) {
  const span = Math.max(max - min, 0.001);
  return PAD.top + (1 - (value - min) / span) * (H - PAD.top - PAD.bottom);
}

function stepPath(series: StatsChartPoint[], min: number, max: number) {
  return series
    .map((point, i) => {
      const x = xAt(i, series.length).toFixed(1);
      const y = yAt(point.value, min, max).toFixed(1);
      return i === 0 ? `M ${x} ${y}` : `H ${x} V ${y}`;
    })
    .join(" ");
}

function areaPath(series: StatsChartPoint[], min: number, max: number) {
  const line = stepPath(series, min, max);
  const x0 = xAt(0, series.length).toFixed(1);
  const xN = xAt(series.length - 1, series.length).toFixed(1);
  const base = (H - PAD.bottom).toFixed(1);
  return `${line} L ${xN} ${base} L ${x0} ${base} Z`;
}

function FlywheelChart({
  series,
  active,
  onHover,
}: {
  series: StatsChartPoint[];
  active: number;
  onHover: (index: number) => void;
}) {
  const min = series[0]?.value ?? 0;
  const max = series[series.length - 1]?.value ?? 1;
  const yTicks = [min, min + (max - min) / 3, min + ((max - min) * 2) / 3, max];
  const point = series[active] ?? series[0];
  const px = xAt(active, series.length);
  const py = yAt(point.value, min, max);
  const midHour = series[Math.floor(series.length / 2)]?.hour ?? 0;
  const lastHour = series[series.length - 1]?.hour ?? 0;

  return (
    <svg
      className="stats-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Cumulative HOOK buyback and burn in ETH"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * W;
        const inner = W - PAD.left - PAD.right;
        const i = Math.round(((x - PAD.left) / inner) * (series.length - 1));
        onHover(Math.min(series.length - 1, Math.max(0, i)));
      }}
    >
      <defs>
        <linearGradient id="stats-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#03b1ed" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#03b1ed" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yAt(tick, min, max)}
            y2={yAt(tick, min, max)}
            className="stats-grid"
          />
          <text x={6} y={yAt(tick, min, max) + 4} className="stats-axis">
            {tick.toFixed(3)}
          </text>
        </g>
      ))}
      <path d={areaPath(series, min, max)} fill="url(#stats-fill)" />
      <path d={stepPath(series, min, max)} className="stats-line" />
      <line x1={px} x2={px} y1={PAD.top} y2={H - PAD.bottom} className="stats-cross" />
      <circle cx={px} cy={py} r="5.5" className="stats-dot" />
      <text x={PAD.left} y={H - 8} className="stats-axis">
        0S
      </text>
      <text x={W / 2 - 14} y={H - 8} className="stats-axis">
        {midHour}H
      </text>
      <text x={W - PAD.right - 40} y={H - 8} className="stats-axis">
        {lastHour}H
      </text>
    </svg>
  );
}

export function ProtocolStatsPage() {
  const overview = useMemo(() => protocolOverview(), []);
  const [active, setActive] = useState(Math.floor(BURN_SERIES.length * 0.72));
  const point = BURN_SERIES[active] ?? BURN_SERIES[0];

  return (
    <div className="market-shell stats-page pt-6 pb-16">
      <header className="stats-head">
        <p className="stats-kicker">Protocol</p>
        <h1>Stats</h1>
        <p>
          Buyback and burn on HOOK, launch volume, and master modules. Figures are protocol-shaped
          until the factory is live on-chain.
        </p>
      </header>

      <div className="stats-metric-grid">
        <Metric
          label="Total volume"
          value={formatCompactUsd(overview.launchVolumeUsd)}
          hint="Tokens issued from Hookit launches"
        />
        <Metric
          label="Supply burned"
          value={`${overview.burnedPct.toFixed(2)}%`}
          hint={`${formatTokenAmount(overview.burned)} / ${formatTokenAmount(overview.totalSupply)} HOOK`}
        />
        <Metric
          label="Buyback + burn"
          value={`${overview.buybackEth.toFixed(3)} ETH`}
          hint={`${overview.buybacks.toLocaleString("en-US")} flywheel txs`}
        />
        <Metric
          label="Master hooks"
          value={String(overview.masterHooks)}
          hint={`${overview.launches} launches on factory`}
        />
      </div>

      <section className="stats-panel">
        <div className="stats-panel-head">
          <p className="stats-kicker">Buyback + burn</p>
          <p className="stats-tooltip">
            {point.label} — {point.value.toFixed(3)} ETH
          </p>
        </div>
        <FlywheelChart series={BURN_SERIES} active={active} onHover={setActive} />
        <div className="stats-freq" aria-hidden>
          {BURN_SERIES.map((row, i) => (
            <span
              key={row.hour}
              className="stats-freq-bar"
              style={{
                height: `${8 + row.burns * 5}px`,
                opacity: i === active ? 1 : 0.45,
              }}
            />
          ))}
        </div>
        <div className="stats-panel-foot">
          <span>Latest {overview.latestWindow} burns</span>
          <span>{overview.buybacks.toLocaleString("en-US")} total</span>
        </div>
      </section>

      <section className="stats-panel">
        <div className="stats-panel-head">
          <p className="stats-kicker">Latest burns · scroll ↓</p>
          <a
            href={`${BASE_SEPOLIA_EXPLORER}/address/0x000000000000000000000000000000000000dEaD`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Dead address ↗
          </a>
        </div>
        <div className="stats-tx-list">
          {BURN_TXS.map((tx) => (
            <a
              key={tx.hash}
              href={`${BASE_SEPOLIA_EXPLORER}/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="stats-tx-row"
            >
              <span className="stats-tx-wallet">{tx.wallet}</span>
              <span>{tx.heldFor}</span>
              <span className="stats-tx-mult">{tx.multiple}</span>
              <span className="stats-tx-amt">{formatTokenAmount(tx.amount)} HOOK</span>
            </a>
          ))}
        </div>
      </section>

      <section className="stats-panel">
        <div className="stats-panel-head">
          <p className="stats-kicker">Master hooks available</p>
          <Link href="/explore">{overview.masterHooks} modules ↗</Link>
        </div>
        <div className="stats-hook-row">
          {MASTER_HOOKS.map((hook) => (
            <Link key={hook.id} href={launchWithHookHref(hook.id)} className="stats-hook-chip">
              {hook.number}. {hook.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stats-metric">
      <p>{label}</p>
      <p>{value}</p>
      <p>{hint}</p>
    </div>
  );
}

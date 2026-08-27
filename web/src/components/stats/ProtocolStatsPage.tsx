"use client";

import { useEffect, useMemo, useState } from "react";

import { StatsAreaChart, StatsBarChart } from "@/components/stats/StatsCharts";
import { useLaunches } from "@/hooks/useLaunches";
import { PROTOCOL_SHARE_BPS } from "@/lib/constants";
import { BASE_SEPOLIA_EXPLORER } from "@/lib/contracts/config";
import { formatCompactUsd, formatFullUsd, formatTokenAmount } from "@/lib/format";
import { fetchIndexerTokens, type IndexerTokenSummary } from "@/lib/indexer-client";
import {
  computeLiveProtocolKpis,
  volumeSnapshotForWindow,
} from "@/lib/live-protocol-stats";
import {
  BUYBACK_BURNS,
  CHART_WINDOWS,
  FEE_BREAKDOWN,
  LATEST_BURNS,
  LATEST_BUYBACKS,
  VOLUME_WINDOWS,
  cumulativeSeries,
  dailyBars,
  type ChartWindow,
  type VolumeWindow,
} from "@/lib/protocol-stats";

const BUYBACK_PCT = PROTOCOL_SHARE_BPS / 100;
const DEAD = "0x000000000000000000000000000000000000dEaD";

export function ProtocolStatsPage() {
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>("all");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("all");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [areaHover, setAreaHover] = useState<number | null>(null);
  const [barHover, setBarHover] = useState<number | null>(null);
  const [indexerTokens, setIndexerTokens] = useState<IndexerTokenSummary[] | null>(null);

  const { data: pools } = useLaunches();

  useEffect(() => {
    let cancelled = false;
    void fetchIndexerTokens()
      .then((res) => {
        if (!cancelled) setIndexerTokens(res.tokens);
      })
      .catch(() => {
        if (!cancelled) setIndexerTokens(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = useMemo(
    () => computeLiveProtocolKpis(pools ?? [], indexerTokens),
    [pools, indexerTokens],
  );
  const volume = volumeSnapshotForWindow(volumeWindow, live);
  const areaSeries = useMemo(() => cumulativeSeries(chartWindow), [chartWindow]);
  const barSeries = useMemo(() => dailyBars(chartWindow), [chartWindow]);
  const areaActive = Math.min(areaHover ?? areaSeries.length - 1, areaSeries.length - 1);
  const barActive = Math.min(barHover ?? barSeries.length - 1, barSeries.length - 1);
  const areaPoint = areaSeries[areaActive] ?? areaSeries[0];
  const barPoint = barSeries[barActive] ?? barSeries[0];
  const tableRows = [...areaSeries].reverse();

  return (
    <div className="market-shell stats-page">
      <header className="stats-head">
        <div className="stats-title-halo" aria-hidden />
        <h1 className="terminal-title">Stats</h1>
        <p className="stats-lede">
          Launch and swap fees on Hookit. {BUYBACK_PCT}% of protocol revenue buys HOOK on the
          market and burns it. Creator share stays with the coin.
        </p>
      </header>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Live protocol</h2>
          <span className="text-[11px] text-zinc-500">
            {live.source === "live" ? "On-chain + indexer" : "Waiting for launches"}
          </span>
        </div>
        <div className="stats-kpi-3">
          <Kpi label="Launches" value={String(live.launches)} hint={`${live.masterLaunches} master · ${live.classicLaunches} classic`} />
          <Kpi label="Liquidity" value={formatFullUsd(live.liquidityUsd)} hint="Sum of pool TVL" />
          <Kpi
            label="24h volume"
            value={formatFullUsd(live.volume24hUsd)}
            hint={`${live.trades24h} trades · ${live.tokensIndexed} indexed`}
          />
        </div>
      </section>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Traded volume</h2>
          <RangePills
            value={volumeWindow}
            options={VOLUME_WINDOWS}
            labels={{ "24h": "24h", "7d": "7d", "30d": "30d", all: "All time" }}
            onChange={setVolumeWindow}
          />
        </div>
        <div className="stats-kpi-3">
          <Kpi
            label="Real volume"
            value={formatFullUsd(volume.realVolumeUsd)}
            hint={
              volumeWindow === "24h" && live.source === "live"
                ? "Live indexer window"
                : "Organic launches and swaps"
            }
          />
          <Kpi
            label="Total volume (Buy / Sell)"
            value={formatFullUsd(volume.buySellVolumeUsd)}
            hint={`Buys ${formatCompactUsd(volume.buyVolumeUsd)} · Sells ${formatCompactUsd(volume.sellVolumeUsd)}`}
          />
          <Kpi
            label="Total volume"
            value={formatFullUsd(volume.totalVolumeUsd)}
            hint="Real + buy/sell flow"
          />
        </div>
        <div className="stats-kpi-3">
          <Kpi
            label="Total revenue"
            value={formatFullUsd(volume.revenueUsd)}
            hint="Protocol + creator fees"
          />
          <Kpi
            label={`${BUYBACK_PCT}% buybacks`}
            value={formatFullUsd(volume.buybackUsd)}
            hint="Protocol share routed to HOOK"
          />
          <Kpi
            label="HOOK earned"
            value={formatTokenAmount(volume.hookEarned)}
            hint="Bought back this window"
          />
        </div>
        {volumeWindow !== "24h" && (
          <p className="mt-2 text-[11px] text-zinc-600">
            Buyback / multi-day series stay illustrative until protocol fee events are indexed.
          </p>
        )}
      </section>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Cumulative buybacks</h2>
          <div className="stats-toolbar">
            <RangePills
              value={chartWindow}
              options={CHART_WINDOWS}
              labels={{ "1d": "1D", "7d": "7D", "30d": "30D", "90d": "90D", all: "All" }}
              onChange={(next) => {
                setChartWindow(next);
                setAreaHover(null);
                setBarHover(null);
              }}
            />
            <RangePills
              value={view}
              options={["chart", "table"] as const}
              labels={{ chart: "Chart", table: "Table" }}
              onChange={setView}
            />
          </div>
        </div>
        {view === "chart" ? (
          <div className="stats-panel">
            <p className="stats-tooltip">
              {areaPoint?.label} — {formatFullUsd(areaPoint?.buybackUsd ?? 0)} buybacks
            </p>
            <StatsAreaChart
              series={areaSeries}
              active={areaActive}
              onHover={setAreaHover}
            />
          </div>
        ) : (
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Cumulative buybacks</th>
                  <th>Cumulative burns</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label + row.buybackUsd}>
                    <td>{row.label}</td>
                    <td>{formatFullUsd(row.buybackUsd)}</td>
                    <td>{formatFullUsd(row.burnUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Daily buyback &amp; burn</h2>
          <div className="stats-legend">
            <span>
              <span className="stats-swatch stats-swatch-buy" /> buyback
            </span>
            <span>
              <span className="stats-swatch stats-swatch-burn" /> burned
            </span>
            <span className="stats-legend-avg">dashed = avg buyback</span>
          </div>
        </div>
        <div className="stats-panel">
          <p className="stats-tooltip">
            {barPoint?.label} — buyback {formatFullUsd(barPoint?.buybackUsd ?? 0)} · burn{" "}
            {formatFullUsd(barPoint?.burnUsd ?? 0)}
          </p>
          <StatsBarChart series={barSeries} active={barActive} onHover={setBarHover} />
        </div>
      </section>

      <div className="stats-feeds">
        <section className="stats-feed">
          <div className="stats-console-head">
            <h2>Latest buybacks</h2>
            <span>{LATEST_BUYBACKS.length} fills</span>
          </div>
          <div className="stats-feed-list">
            {LATEST_BUYBACKS.map((tx) => (
              <a
                key={tx.hash}
                href={`${BASE_SEPOLIA_EXPLORER}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stats-feed-row"
              >
                <div>
                  <p>
                    {tx.spentEth} ETH → {formatTokenAmount(tx.hookOut)} HOOK
                  </p>
                  <p>
                    {tx.ago} · View txn
                  </p>
                </div>
                <strong>{formatCompactUsd(tx.usd)}</strong>
              </a>
            ))}
          </div>
        </section>
        <section className="stats-feed">
          <div className="stats-console-head">
            <h2>Buyback burns</h2>
            <a
              href={`${BASE_SEPOLIA_EXPLORER}/address/${DEAD}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              dead ↗
            </a>
          </div>
          <div className="stats-feed-list">
            {BUYBACK_BURNS.map((tx) => (
              <a
                key={tx.hash}
                href={`${BASE_SEPOLIA_EXPLORER}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stats-feed-row"
              >
                <div>
                  <p>{formatTokenAmount(tx.amount)} HOOK</p>
                  <p>
                    {tx.ago} · View txn
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Fees paid in HOOK</h2>
        </div>
        <div className="stats-kpi-4">
          <Kpi label="HOOK earned" value={formatTokenAmount(FEE_BREAKDOWN.hookEarned)} />
          <Kpi label="Sent to dead" value={formatTokenAmount(FEE_BREAKDOWN.sentToDead)} />
          <Kpi label="Classic launches" value={formatTokenAmount(FEE_BREAKDOWN.classicLaunches)} />
          <Kpi label="Custom launches" value={formatTokenAmount(FEE_BREAKDOWN.customLaunches)} />
        </div>
        <div className="stats-console stats-console-log">
          <div className="stats-console-head">
            <p className="stats-console-label">~/ latest burns</p>
          </div>
          <div className="stats-tx-list">
            {LATEST_BURNS.map((tx) => (
              <a
                key={tx.hash}
                href={`${BASE_SEPOLIA_EXPLORER}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stats-tx-row"
              >
                <span className="stats-tx-prompt" aria-hidden>
                  $
                </span>
                <span className="stats-tx-wallet">
                  {formatTokenAmount(tx.amount)} HOOK burned
                </span>
                <span className="stats-tx-amt">{tx.ago}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stats-metric">
      <p>{label}</p>
      <p>{value}</p>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

function RangePills<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="stats-range" role="tablist">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={value === option ? "is-on" : undefined}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

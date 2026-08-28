"use client";

import { useEffect, useMemo, useState } from "react";

import { StatsAreaChart, StatsBarChart } from "@/components/stats/StatsCharts";
import { useLaunches } from "@/hooks/useLaunches";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatCompactUsd, formatFullUsd, formatTokenAmount } from "@/lib/format";
import { fetchIndexerTokens, type IndexerTokenSummary } from "@/lib/indexer-client";
import {
  computeLiveProtocolKpis,
  volumeSnapshotForWindow,
} from "@/lib/live-protocol-stats";
import {
  BUYBACK_BURNS,
  CHART_WINDOWS,
  LATEST_BUYBACKS,
  NATIVE_TOKEN,
  VOLUME_BY_WINDOW,
  VOLUME_WINDOWS,
  cumulativeSeries,
  dailyBars,
  metricLabel,
  metricSubtitle,
  metricValue,
  protocolOverview,
  type ChartMetric,
  type ChartWindow,
  type VolumeWindow,
} from "@/lib/protocol-stats";

const DEAD = "0x000000000000000000000000000000000000dEaD";
const CHART_METRICS = ["buybacks", "revenue", "burns", "fdv"] as const;
const METRIC_LABELS: Record<ChartMetric, string> = {
  buybacks: "Buybacks",
  revenue: "Revenue",
  burns: "Burns",
  fdv: `$${NATIVE_TOKEN} FDV`,
};

export function ProtocolStatsPage() {
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>("all");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("90d");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("buybacks");
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

  const overview = useMemo(() => protocolOverview(), []);

  const volume = useMemo(() => {
    const base = VOLUME_BY_WINDOW[volumeWindow];
    if (volumeWindow !== "24h" || live.source !== "live" || live.volume24hUsd <= 0) {
      return base;
    }
    const snap = volumeSnapshotForWindow("24h", live);
    return {
      ...base,
      realVolumeUsd: snap.realVolumeUsd,
      buyVolumeUsd: snap.buyVolumeUsd,
      sellVolumeUsd: snap.sellVolumeUsd,
      buySellVolumeUsd: snap.buySellVolumeUsd,
      totalVolumeUsd: snap.totalVolumeUsd,
      revenueUsd: snap.revenueUsd,
      buybackUsd: snap.buybackUsd,
    };
  }, [volumeWindow, live]);

  const areaSeries = useMemo(() => {
    const bars = dailyBars(chartWindow);
    if (chartMetric === "fdv") return bars;
    return cumulativeSeries(chartWindow);
  }, [chartWindow, chartMetric]);

  const barSeries = useMemo(() => dailyBars(chartWindow), [chartWindow]);
  const areaActive = Math.min(areaHover ?? areaSeries.length - 1, areaSeries.length - 1);
  const barActive = Math.min(barHover ?? barSeries.length - 1, barSeries.length - 1);
  const areaPoint = areaSeries[areaActive] ?? areaSeries[0];
  const barPoint = barSeries[barActive] ?? barSeries[0];
  const tableRows = [...areaSeries].reverse();
  const barAvg =
    barSeries.reduce((sum, point) => sum + point.buybackUsd, 0) / Math.max(barSeries.length, 1);

  const areaTooltipValue = metricValue(areaPoint ?? areaSeries[0]!, chartMetric);

  return (
    <div className="market-shell stats-page">
      <header className="stats-head">
        <div className="stats-title-halo" aria-hidden />
        <h1 className="terminal-title">Stats</h1>
        <p className="stats-lede">
          80% of protocol revenue buys HKT on the market and burn it.
        </p>
      </header>

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
        <div className="stats-kpi-4">
          <Kpi
            label="Total volume"
            value={formatFullUsd(volume.totalVolumeUsd)}
            hint="All venues across the selected window"
          />
          <Kpi
            label="Total revenue"
            value={formatFullUsd(volume.revenueUsd)}
            hint="Trading fees paid to the platform, valued at claim time"
          />
          <Kpi
            label="Total buybacks"
            value={formatFullUsd(volume.buybackUsd)}
            hint={`${formatTokenAmount(overview.hookBought)} ${NATIVE_TOKEN} bought over ${overview.buybacks.toLocaleString()} swaps`}
          />
          <Kpi
            label="$HKR burned"
            value={formatFullUsd(overview.burnedUsd)}
            hint={`Current value of ${formatTokenAmount(overview.burned)} HKR destroyed`}
          />
        </div>
      </section>

      <section className="stats-block stats-charts-block">
        <div className="stats-charts-card">
          <div className="stats-block-head stats-charts-card-head">
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

          <div className="stats-chart-section">
            <div className="stats-chart-section-head">
              <div>
                <h3>{metricLabel(chartMetric)}</h3>
                <p>{metricSubtitle(chartMetric)}</p>
              </div>
              <RangePills
                value={chartMetric}
                options={CHART_METRICS}
                labels={METRIC_LABELS}
                onChange={(next) => {
                  setChartMetric(next);
                  setAreaHover(null);
                }}
              />
            </div>

            {view === "chart" ? (
              <div className="stats-panel stats-panel-inset">
                <p className="stats-tooltip">
                  {areaPoint?.label} — {formatFullUsd(areaTooltipValue)}
                  {chartMetric === "buybacks" ? " buybacks" : ""}
                  {chartMetric === "revenue" ? " revenue" : ""}
                  {chartMetric === "burns" ? " burned" : ""}
                  {chartMetric === "fdv" ? " FDV" : ""}
                </p>
                <StatsAreaChart
                  series={areaSeries}
                  active={areaActive}
                  metric={chartMetric}
                  onHover={setAreaHover}
                />
              </div>
            ) : (
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>{metricLabel(chartMetric)}</th>
                      <th>Cumulative burns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.label + row.buybackUsd}>
                        <td>{row.label}</td>
                        <td>{formatFullUsd(metricValue(row, chartMetric))}</td>
                        <td>{formatFullUsd(row.burnUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="stats-chart-section stats-chart-section-divider">
            <div className="stats-chart-section-head">
              <div>
                <h3>Daily buyback &amp; burn</h3>
                <p>
                  What each day spent buying ${NATIVE_TOKEN}, beside the value it destroyed through
                  burns.
                </p>
              </div>
              <div className="stats-legend">
                <span className="stats-legend-avg">Daily average {formatFullUsd(barAvg)}</span>
                <span>
                  <span className="stats-swatch stats-swatch-buy" /> Bought
                </span>
                <span>
                  <span className="stats-swatch stats-swatch-burn" /> Burned
                </span>
              </div>
            </div>
            <div className="stats-panel stats-panel-inset">
              <p className="stats-tooltip">
                {barPoint?.label} — bought {formatFullUsd(barPoint?.buybackUsd ?? 0)} · burned{" "}
                {formatFullUsd(barPoint?.burnUsd ?? 0)}
              </p>
              <StatsBarChart series={barSeries} active={barActive} onHover={setBarHover} />
            </div>
          </div>
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
                href={`${BLOCK_EXPLORER_URL}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stats-feed-row"
              >
                <div>
                  <p>
                    {tx.spentEth} ETH → {formatTokenAmount(tx.hookOut)} {NATIVE_TOKEN}
                  </p>
                  <p>
                    {tx.ago} · swap tx ↗
                  </p>
                </div>
                <strong>{formatCompactUsd(tx.usd)}</strong>
              </a>
            ))}
          </div>
        </section>

        <section className="stats-feed">
          <div className="stats-console-head">
            <h2>
              <span className="stats-flame" aria-hidden>
                🔥
              </span>{" "}
              Buyback burns
            </h2>
            <a href={`${BLOCK_EXPLORER_URL}/address/${DEAD}`} target="_blank" rel="noopener noreferrer">
              dead ↗
            </a>
          </div>
          <div className="stats-feed-list">
            {BUYBACK_BURNS.map((tx) => (
              <a
                key={tx.hash}
                href={`${BLOCK_EXPLORER_URL}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stats-feed-row"
              >
                <div>
                  <p>
                    {formatTokenAmount(tx.amount)} {NATIVE_TOKEN}
                  </p>
                  <p>
                    {tx.ago} · burn tx ↗
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
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

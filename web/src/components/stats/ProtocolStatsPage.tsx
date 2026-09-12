"use client";

import { useMemo, useState } from "react";

import { StatsBarChart } from "@/components/stats/StatsCharts";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatCompactUsd, formatFullUsd, formatTokenAmount } from "@/lib/format";
import { hktHolderDropFromVolumeUsd } from "@/lib/protocol-fees";
import {
  type ChartWindow,
  type VolumeWindow,
  VOLUME_WINDOWS,
  CHART_WINDOWS,
} from "@/lib/protocol-stats";
import { useProtocolStats } from "@/hooks/useProtocolStats";

const DEAD = "0x000000000000000000000000000000000000dEaD";

export function ProtocolStatsPage() {
  const { data: stats, dataUpdatedAt } = useProtocolStats();
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>("all");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("90d");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [barHover, setBarHover] = useState<number | null>(null);

  const volume = stats?.windows[volumeWindow];
  const overview = stats?.windows.all;
  const nativeSymbol =
    stats?.nativeToken && stats.nativeToken !== "HTST" ? stats.nativeToken : "protocol token";

  const barSeries = useMemo(() => {
    if (!stats) return [];
    if (chartWindow === "1d") return stats.hourly.slice(-24);
    let daily = stats.daily;
    if (chartWindow === "7d") daily = daily.slice(-7);
    else if (chartWindow === "30d") daily = daily.slice(-30);
    else if (chartWindow === "90d") daily = daily.slice(-90);
    return daily;
  }, [stats, chartWindow]);

  const barActive = Math.min(barHover ?? Math.max(barSeries.length - 1, 0), Math.max(barSeries.length - 1, 0));
  const barPoint = barSeries[barActive] ?? barSeries[0];
  const tableRows = [...barSeries].reverse();
  const barAvg =
    barSeries.reduce((sum, point) => sum + point.buybackUsd, 0) / Math.max(barSeries.length, 1);

  return (
    <div className="market-shell stats-page">
      <header className="stats-head">
        <h1 className="terminal-title">Analytics</h1>
        <p className="stats-lede">
          Stock-denominated protocol fees consolidate into USDG. Buyback activates with the official protocol token.
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
        <div className="stats-kpi-volume">
          <Kpi
            label="Total volume"
            value={formatFullUsd(volume?.totalVolumeUsd ?? 0)}
            hint={
              volumeWindow === "24h" && stats?.indexerOk
                ? "Live indexer window"
                : "Indexed swap volume"
            }
          />
          <Kpi
            label="Revenue"
            value={formatFullUsd(volume?.revenueUsd ?? overview?.revenueUsd ?? 0)}
            hint="Indexed volume × on-chain protocol fee schedule"
          />
          <Kpi
            label="$HKT burned"
            value={
              stats?.totalHookBought
                ? `${formatTokenAmount(stats.totalHookBought)} $HKT`
                : formatFullUsd(stats?.totalBuybacksUsd ?? 0)
            }
            hint={
              stats?.totalBuybacksCount
                ? `${formatFullUsd(stats.totalBuybacksUsd)} · ${stats.totalBuybacksCount} fills`
                : "On-chain BuybackBurned events only"
            }
          />
          <Kpi
            label="Sent to $HKT holders"
            value={formatFullUsd(hktHolderDropFromVolumeUsd(volume?.totalVolumeUsd ?? 0))}
            hint={`${formatCount(stats?.hktHolderDrop?.tokensSent ?? 0)} tokens · ${formatCount(stats?.hktHolderDrop?.wallets ?? 0)} wallet transfers`}
          />
          <HktDropRank rows={stats?.hktHolderDrop?.topTokens ?? []} />
        </div>
        {stats?.pendingBuybackEth ? (
          <p className="stats-footnote">
            Pending buyback pot: {stats.pendingBuybackEth.toFixed(4)} ETH on distributor
          </p>
        ) : null}
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

          {barSeries.length === 0 ? (
            <p className="stats-empty">No chart data yet. swaps will populate once the indexer catches up.</p>
          ) : (
            <>
              <div className="stats-chart-section">
                <div className="stats-chart-section-head">
                  <div>
                    <h3>Daily buyback &amp; burn</h3>
                    <p>
                      Derived from indexed swap volume. buyback and burn estimates update as trades
                      are indexed.
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
                {view === "chart" ? (
                  <div className="stats-panel stats-panel-inset">
                    <p className="stats-tooltip">
                      {barPoint?.label ?? "—"}. bought {formatFullUsd(barPoint?.buybackUsd ?? 0)} · burned{" "}
                      {formatFullUsd(barPoint?.burnUsd ?? 0)}
                    </p>
                    <StatsBarChart series={barSeries} active={barActive} onHover={setBarHover} />
                  </div>
                ) : (
                  <div className="stats-table-wrap">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Bought</th>
                          <th>Burned</th>
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
              </div>
            </>
          )}
        </div>
      </section>

      <div className="stats-feeds">
        <section className="stats-feed">
          <div className="stats-console-head">
            <h2>Latest buybacks</h2>
            <span>{stats?.latestBuybacks.length ?? 0} fills</span>
          </div>
          <div className="stats-feed-list">
            {(stats?.latestBuybacks.length ?? 0) === 0 ? (
              <p className="stats-empty-inline">No on-chain buyback events yet.</p>
            ) : (
              stats!.latestBuybacks.map((tx) => (
                <a
                  key={tx.hash}
                  href={`${BLOCK_EXPLORER_URL}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stats-feed-row"
                >
                  <div>
                    <p>
                      {tx.spentEth.toFixed(4)} ETH → {formatTokenAmount(tx.hookOut)} {nativeSymbol}
                    </p>
                    <p>
                      {tx.ago} · swap tx ↗
                    </p>
                  </div>
                  <strong>{formatCompactUsd(tx.usd)}</strong>
                </a>
              ))
            )}
          </div>
        </section>

        <section className="stats-feed">
          <div className="stats-console-head">
            <h2>Buyback burns</h2>
            <a href={`${BLOCK_EXPLORER_URL}/address/${DEAD}`} target="_blank" rel="noopener noreferrer">
              dead ↗
            </a>
          </div>
          <div className="stats-feed-list">
            {(stats?.buybackBurns.length ?? 0) === 0 ? (
              <p className="stats-empty-inline">No burn events indexed yet.</p>
            ) : (
              stats!.buybackBurns.map((tx) => (
                <a
                  key={tx.hash}
                  href={`${BLOCK_EXPLORER_URL}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stats-feed-row"
                >
                  <div>
                    <p>
                      {formatTokenAmount(tx.amount)} {nativeSymbol}
                    </p>
                    <p>
                      {tx.agoLabel} · burn tx ↗
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </section>
      </div>

      {dataUpdatedAt ? (
        <p className="stats-footnote stats-footnote-muted">
          Auto-refresh every 15s · last sync {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  );
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

const HKT_RANK_SLOTS = 5;

function HktDropRank({
  rows,
}: {
  rows: Array<{ ticker: string; wallets: number; payouts: number }>;
}) {
  const filled = Array.from({ length: HKT_RANK_SLOTS }, (_, index) => rows[index] ?? null);
  return (
    <div className="stats-metric stats-hkt-rank">
      <p>Top tokens to $HKT holders</p>
      <ul>
        {filled.map((row, index) =>
          row ? (
            <li key={row.ticker}>
              <span>{row.ticker}</span>
              <span>{formatCount(row.wallets)} wallets</span>
              <span>{formatCount(row.payouts)} payouts</span>
            </li>
          ) : (
            <li key={`empty-${index}`} className="is-empty">
              <span>—</span>
              <span>0 wallets</span>
              <span>0 payouts</span>
            </li>
          ),
        )}
      </ul>
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

"use client";

import { useEffect, useMemo, useState } from "react";

import { useLaunches } from "@/hooks/useLaunches";
import { PROTOCOL_SHARE_BPS } from "@/lib/constants";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { formatCompactUsd, formatFullUsd } from "@/lib/format";
import { fetchIndexerTokens, type IndexerTokenSummary } from "@/lib/indexer-client";
import {
  computeLiveProtocolKpis,
  volumeSnapshotForWindow,
} from "@/lib/live-protocol-stats";
import { VOLUME_WINDOWS, type VolumeWindow } from "@/lib/protocol-stats";

const BUYBACK_PCT = PROTOCOL_SHARE_BPS / 100;
const DEAD = "0x000000000000000000000000000000000000dEaD";

export function ProtocolStatsPage() {
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>("24h");
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

  const feeSplit = useMemo(() => {
    const master = live.masterLaunches;
    const classic = live.classicLaunches;
    const total = Math.max(1, master + classic);
    return {
      masterShare: master / total,
      classicShare: classic / total,
    };
  }, [live.classicLaunches, live.masterLaunches]);

  return (
    <div className="market-shell stats-page">
      <header className="stats-head">
        <div className="stats-title-halo" aria-hidden />
        <h1 className="terminal-title">Stats</h1>
        <p className="stats-lede">
          Live launches, TVL, and indexed volume. Buyback fills appear here when protocol fee
          events are indexed — no mock series.
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
          <Kpi
            label="Launches"
            value={String(live.launches)}
            hint={`${live.masterLaunches} master · ${live.classicLaunches} classic`}
          />
          <Kpi label="Liquidity" value={formatFullUsd(live.liquidityUsd)} hint="Sum of pool TVL" />
          <Kpi
            label="Market cap"
            value={formatFullUsd(live.marketCapUsd)}
            hint="Sum of listed FDV"
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
        {volumeWindow === "24h" ? (
          <>
            <div className="stats-kpi-3">
              <Kpi
                label="Real volume"
                value={formatFullUsd(volume.realVolumeUsd)}
                hint={live.source === "live" ? "Live indexer window" : "No indexer volume yet"}
              />
              <Kpi
                label="Trades"
                value={String(live.trades24h)}
                hint={`${live.tokensIndexed} tokens indexed`}
              />
              <Kpi
                label="Est. protocol revenue"
                value={formatFullUsd(volume.revenueUsd)}
                hint={`${BUYBACK_PCT}% of quote volume (est.)`}
              />
            </div>
            <div className="stats-kpi-3">
              <Kpi
                label={`Est. ${BUYBACK_PCT}% buybacks`}
                value={formatFullUsd(volume.buybackUsd)}
                hint="Derived from volume until buyback txs are indexed"
              />
              <Kpi
                label="Buy volume (est.)"
                value={formatCompactUsd(volume.buyVolumeUsd)}
                hint="55/45 split heuristic"
              />
              <Kpi
                label="Sell volume (est.)"
                value={formatCompactUsd(volume.sellVolumeUsd)}
                hint="55/45 split heuristic"
              />
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-zinc-500">
            Multi-day volume windows need historical indexer rollups. Use <strong className="text-zinc-300">24h</strong>{" "}
            for live data.
          </p>
        )}
      </section>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Buybacks &amp; burns</h2>
        </div>
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
          <p className="text-sm text-zinc-300">No buyback or burn events indexed yet</p>
          <p className="mt-2 text-[12px] text-zinc-600">
            When the fee escrow / HOOK buyback path emits events, fills will list here with explorer
            links. Estimated revenue above is from swap volume only.
          </p>
          <a
            href={`${BLOCK_EXPLORER_URL}/address/${DEAD}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-[12px] text-[#d8b4fe] hover:underline"
          >
            Dead address ↗
          </a>
        </div>
      </section>

      <section className="stats-block">
        <div className="stats-block-head">
          <h2>Launch mix</h2>
        </div>
        <div className="stats-kpi-3">
          <Kpi
            label="Master share"
            value={`${Math.round(feeSplit.masterShare * 100)}%`}
            hint={`${live.masterLaunches} launches`}
          />
          <Kpi
            label="Classic share"
            value={`${Math.round(feeSplit.classicShare * 100)}%`}
            hint={`${live.classicLaunches} launches`}
          />
          <Kpi label="Indexed tokens" value={String(live.tokensIndexed)} hint="House indexer" />
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

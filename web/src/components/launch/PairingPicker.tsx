"use client";

import { PairingMark } from "@/components/launch/PairingMark";
import { PickCard } from "@/components/launch/PickCard";
import { SegmentedControl } from "@/components/ui/form-primitives";
import { Slider } from "@/components/ui/slider";
import {
  PAIRING_TOKENS,
  type PairingTokenId,
} from "@/lib/pairing-tokens";
import type { LaunchMarketInput } from "@/lib/types";

const MAX_MARKETS = 5;
const BPS_TOTAL = 10_000;

function equalSplit(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(BPS_TOTAL / count);
  const out = Array.from({ length: count }, () => base);
  out[count - 1] = BPS_TOTAL - base * (count - 1);
  return out;
}

function rebalanceBps(items: LaunchMarketInput[], index: number, nextBps: number): LaunchMarketInput[] {
  const clamped = Math.max(100, Math.min(BPS_TOTAL - (items.length - 1) * 100, nextBps));
  const others = items.length - 1;
  if (others === 0) return [{ ...items[0], bps: BPS_TOTAL }];

  const remaining = BPS_TOTAL - clamped;
  const perOther = Math.floor(remaining / others);
  let leftover = remaining - perOther * others;

  return items.map((item, i) => {
    if (i === index) return { ...item, bps: clamped };
    const extra = leftover > 0 ? 1 : 0;
    if (extra) leftover -= 1;
    return { ...item, bps: perOther + extra };
  });
}

export function PairingPicker({
  markets,
  floorQuoteIndex,
  onMarketsChange,
  onFloorQuoteIndexChange,
}: {
  markets: LaunchMarketInput[];
  floorQuoteIndex: number;
  onMarketsChange: (markets: LaunchMarketInput[]) => void;
  onFloorQuoteIndexChange: (index: number) => void;
}) {
  const isMulti = markets.length > 1;
  const selectedIds = new Set(markets.map((m) => m.id));

  const setMode = (mode: "single" | "multi") => {
    if (mode === "single") {
      const primary = markets[0] ?? { id: "eth" as PairingTokenId, bps: BPS_TOTAL };
      onMarketsChange([{ id: primary.id, bps: BPS_TOTAL }]);
      onFloorQuoteIndexChange(0);
      return;
    }
    if (markets.length > 1) return;
    const primary = markets[0] ?? { id: "eth" as PairingTokenId, bps: BPS_TOTAL };
    const second = PAIRING_TOKENS.find((t) => t.id !== primary.id);
    if (!second) return;
    const split = equalSplit(2);
    onMarketsChange([
      { id: primary.id, bps: split[0]! },
      { id: second.id, bps: split[1]! },
    ]);
  };

  const toggle = (id: PairingTokenId) => {
    if (!isMulti) {
      onMarketsChange([{ id, bps: BPS_TOTAL }]);
      return;
    }
    if (selectedIds.has(id)) {
      if (markets.length <= 1) return;
      const next = markets.filter((m) => m.id !== id);
      const split = equalSplit(next.length);
      onMarketsChange(next.map((m, i) => ({ ...m, bps: split[i]! })));
      if (floorQuoteIndex >= next.length) onFloorQuoteIndexChange(0);
      return;
    }
    if (markets.length >= MAX_MARKETS) return;
    const next = [...markets, { id, bps: 0 }];
    const split = equalSplit(next.length);
    onMarketsChange(next.map((m, i) => ({ id: m.id, bps: split[i]! })));
  };

  const totalBps = markets.reduce((sum, m) => sum + m.bps, 0);

  return (
    <div>
      <div className="mb-4">
        <SegmentedControl
          value={isMulti ? "multi" : "single"}
          onChange={(mode) => setMode(mode)}
          options={[
            { value: "single", label: "Single pair" },
            { value: "multi", label: "Multi-pair (2–5)" },
          ]}
        />
        <p className="mt-2 text-xs text-zinc-600">
          {isMulti
            ? "One token, several locked v4 pools — supply split by weight. Same launch FDV per leg."
            : "Classic one-pool launch against a single quote asset."}
        </p>
      </div>

      <p className="pick-kicker">
        —{markets.length} market{markets.length === 1 ? "" : "s"} · pick 1–{isMulti ? MAX_MARKETS : 1} quote
        {isMulti ? `s (${totalBps / 100}% allocated)` : ""}
      </p>
      <p className="pick-heading">pick your pair{isMulti ? "s" : ""}</p>
      <div className="pick-grid pick-grid--pairs">
        {PAIRING_TOKENS.map((token) => (
          <PickCard
            key={token.id}
            selected={selectedIds.has(token.id)}
            title={token.ticker}
            subtitle={
              selectedIds.has(token.id)
                ? isMulti
                  ? `${((markets.find((m) => m.id === token.id)?.bps ?? 0) / 100).toFixed(1)}% liq`
                  : token.subtitle
                : token.subtitle
            }
            onClick={() => toggle(token.id)}
          >
            <PairingMark id={token.id} />
          </PickCard>
        ))}
      </div>

      {isMulti && (
        <div className="mt-5 space-y-4 rounded-lg border border-zinc-800/80 bg-black/40 p-4">
          <p className="text-xs text-zinc-500">Liquidity split across pools (must total 100%)</p>
          {markets.map((market, index) => {
            const token = PAIRING_TOKENS.find((t) => t.id === market.id);
            return (
              <div key={market.id}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-zinc-300">
                    <PairingMark id={market.id} size="sm" />
                    <span>{token?.ticker ?? market.id}</span>
                  </span>
                  <span className="font-mono text-zinc-400">{(market.bps / 100).toFixed(1)}%</span>
                </div>
                <Slider
                  min={100}
                  max={BPS_TOTAL - (markets.length - 1) * 100}
                  step={100}
                  value={[market.bps]}
                  onValueChange={([v]) =>
                    onMarketsChange(rebalanceBps(markets, index, v ?? market.bps))
                  }
                />
              </div>
            );
          })}
          <div>
            <p className="mb-2 text-xs text-zinc-500">
              Floor quote (when backed floor ships for multi) — stored for later
            </p>
            <div className="flex flex-wrap gap-2">
              {markets.map((market, index) => {
                const token = PAIRING_TOKENS.find((t) => t.id === market.id);
                return (
                  <button
                    key={market.id}
                    type="button"
                    disabled
                    title="Backed floor disabled for multi-pool launches in v1"
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      floorQuoteIndex === index
                        ? "border-emerald-600/50 text-emerald-400"
                        : "border-zinc-800 text-zinc-600"
                    }`}
                  >
                    <PairingMark id={market.id} size="sm" />
                    {token?.ticker ?? market.id}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-amber-600/90">
            Multi-pool: Backed floor is not available yet (single-pair only for now). Anti-snipe,
            anti-MEV, fees, and other modules still apply on every pool.
          </p>
        </div>
      )}
    </div>
  );
}

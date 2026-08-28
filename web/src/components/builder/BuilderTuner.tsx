"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { AccentSlider } from "@/components/launch/AccentSlider";
import { MAX_HOOK_TAX_BPS } from "@/lib/constants";
import { estimateFloorPrice, formatBps } from "@/lib/format";
import { ALL_LIVE_BY_ID, type LiveBlockId } from "@/lib/hook-builder";
import type { LaunchModules } from "@/lib/types";

type Props = {
  selected: LiveBlockId | null;
  soonNote: { label: string; description: string } | null;
  modules: LaunchModules;
  hookTaxBps: number;
  onModulesChange: (patch: Partial<LaunchModules>) => void;
  onCreatorTaxChange: (bps: number) => void;
  onRemove: (id: LiveBlockId) => void;
};

export function BuilderTuner({
  selected,
  soonNote,
  modules,
  hookTaxBps,
  onModulesChange,
  onCreatorTaxChange,
  onRemove,
}: Props) {
  if (soonNote) {
    return (
      <div className="gel-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-zinc-600">Coming soon</p>
        <h3 className="mt-1 text-sm font-medium text-zinc-100">{soonNote.label}</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{soonNote.description}</p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Live blocks settle through MasterLaunchHook (quote-only delta). These need new
          protocol surface — they are listed so the circuit matches the product, not vapor.
        </p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="gel-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-zinc-600">Market behavior</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Select a rule to tune its parameters. Empty circuit = 1% quote fee, locked
          unilateral LP, $4k FDV.
        </p>
      </div>
    );
  }

  const def = ALL_LIVE_BY_ID[selected];
  const Icon = def.accent.icon;

  return (
    <div
      className="gel-surface p-4"
      style={{ boxShadow: `inset 3px 0 0 0 ${def.accent.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10"
            style={{ background: `${def.accent.color}18` }}
          >
            <Icon className="h-4 w-4" style={{ color: def.accent.color }} />
          </span>
          <div>
            <h3 className="text-sm font-medium text-zinc-100">{def.label}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{def.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(selected)}
          className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-white/5 hover:text-zinc-300"
          aria-label={`Remove ${def.label}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Mounted>
        {selected === "antiSnipe" ? (
          <div className="grid gap-4">
            <SliderRow
              label="Duration"
              valueLabel={`${modules.antiSnipeDuration}s`}
              color={def.accent.color}
              value={modules.antiSnipeDuration}
              min={1}
              max={10}
              step={1}
              onChange={(v) => onModulesChange({ antiSnipeDuration: v })}
            />
            <SliderRow
              label="Initial tax"
              valueLabel={`${modules.antiSnipeInitialTax}%`}
              color={def.accent.color}
              value={modules.antiSnipeInitialTax}
              min={50}
              max={99}
              step={1}
              onChange={(v) => onModulesChange({ antiSnipeInitialTax: v })}
            />
          </div>
        ) : null}

        {selected === "backedFloor" ? (
          <div>
            <SliderRow
              label="Fee to floor"
              valueLabel={`${modules.floorAllocation}%`}
              color={def.accent.color}
              value={modules.floorAllocation}
              min={0}
              max={50}
              step={1}
              onChange={(v) => onModulesChange({ floorAllocation: v })}
            />
            <p className="mt-2 font-mono text-[11px]" style={{ color: `${def.accent.color}cc` }}>
              Est. floor ≈ {estimateFloorPrice(modules.floorAllocation, 0).toFixed(6)} ETH / token
            </p>
          </div>
        ) : null}

        {selected === "autoBurn" ? (
          <div>
            <SliderRow
              label="Fee to buyback & burn"
              valueLabel={`${modules.autoBurnPct}%`}
              color={def.accent.color}
              value={modules.autoBurnPct}
              min={1}
              max={50}
              step={1}
              onChange={(v) => onModulesChange({ autoBurnPct: v })}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              After the swap, this cut of quote fees buys the token and burns it. Nested buy
              skips extra hook tax. Floor + burn + LP donate cannot exceed 100%.
            </p>
          </div>
        ) : null}

        {selected === "lpDonate" ? (
          <div>
            <SliderRow
              label="Fee donated to LP"
              valueLabel={`${modules.lpDonatePct}%`}
              color={def.accent.color}
              value={modules.lpDonatePct}
              min={1}
              max={50}
              step={1}
              onChange={(v) => onModulesChange({ lpDonatePct: v })}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Uniswap v4 donate to in-range LPs. If the pool has no in-range liquidity yet,
              the cut falls back to the floor vault.
            </p>
          </div>
        ) : null}

        {selected === "holderAirdrop" ? (
          <div>
            <SliderRow
              label="Fee to holder airdrop"
              valueLabel={`${modules.holderAirdropPct}%`}
              color={def.accent.color}
              value={modules.holderAirdropPct}
              min={1}
              max={50}
              step={1}
              onChange={(v) => onModulesChange({ holderAirdropPct: v })}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Quote fees accrue in a vault. Every 15 minutes anyone can push a pro-rata
              airdrop to holders (in ETH / USDG / wStock). Floor + burn + LP + airdrop
              cannot exceed 100%.
            </p>
          </div>
        ) : null}

        {selected === "maxWallet" ? (
          <SliderRow
            label="Cap"
            valueLabel={`${(modules.maxWalletBps / 100).toFixed(1)}% supply`}
            color={def.accent.color}
            value={modules.maxWalletBps / 100}
            min={0.5}
            max={5}
            step={0.1}
            onChange={(v) => onModulesChange({ maxWalletBps: Math.round(v * 100) })}
          />
        ) : null}

        {selected === "maxTx" ? (
          <SliderRow
            label="Cap"
            valueLabel={`${(modules.maxTxBps / 100).toFixed(1)}% supply`}
            color={def.accent.color}
            value={modules.maxTxBps / 100}
            min={0.5}
            max={5}
            step={0.1}
            onChange={(v) => onModulesChange({ maxTxBps: Math.round(v * 100) })}
          />
        ) : null}

        {selected === "hookTax" ? (
          <SliderRow
            label="Hook tax"
            valueLabel={formatBps(hookTaxBps)}
            color={def.accent.color}
            value={hookTaxBps}
            min={10}
            max={MAX_HOOK_TAX_BPS}
            step={10}
            onChange={onCreatorTaxChange}
          />
        ) : null}

        {selected === "creatorShareToHook" ? (
          <p className="text-xs leading-relaxed text-zinc-600">
            Your 70% of the base 1% joins the hook pot with hook tax (same module split). Protocol keeps
            its 30%. Disable to claim creator fees from escrow instead.
          </p>
        ) : null}

        {selected === "antiMev" ? (
          <p className="text-xs leading-relaxed text-zinc-600">
            Transient storage per origin and block. Opposite-direction swaps in the same
            block revert. Not a private-mempool guarantee.
          </p>
        ) : null}
        </Mounted>
      </div>
    </div>
  );
}

function Mounted({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(true);
  }, []);
  if (!ok) return null;
  return children;
}

function SliderRow({
  label,
  valueLabel,
  color,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  valueLabel: string;
  color: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono" style={{ color }}>
          {valueLabel}
        </span>
      </div>
      <AccentSlider
        accentColor={color}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

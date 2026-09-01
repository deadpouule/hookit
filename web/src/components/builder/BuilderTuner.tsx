"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { AccentSlider } from "@/components/launch/AccentSlider";
import { MAX_HOOK_TAX_BPS } from "@/lib/constants";
import { estimateFloorPrice, formatBps } from "@/lib/format";
import {
  clampSupplyCapBps,
  MAX_ANTI_SNIPE_DURATION_SEC,
  MAX_ANTI_SNIPE_TAX_PCT,
  MAX_SUPPLY_CAP_SLIDER_PCT,
  MIN_ANTI_SNIPE_DURATION_SEC,
  MIN_ANTI_SNIPE_TAX_PCT,
  MIN_SUPPLY_CAP_SLIDER_PCT,
  bpsToSupplyPct,
  formatSupplyCap,
  supplyPctToBps,
} from "@/lib/protocol-limits";
import { ALL_LIVE_BY_ID, type LiveBlockId } from "@/lib/hook-builder";
import {
  feeRouteIsComplete,
  feeRouteSliderMax,
  feeRouteTotalPct,
  listEnabledFeeRoutes,
  setFeeRouteShare,
  type FeeRouteKey,
} from "@/lib/hook-fee-route";
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
              min={MIN_ANTI_SNIPE_DURATION_SEC}
              max={MAX_ANTI_SNIPE_DURATION_SEC}
              step={1}
              onChange={(v) => onModulesChange({ antiSnipeDuration: v })}
            />
            <SliderRow
              label="Initial tax"
              valueLabel={`${modules.antiSnipeInitialTax}%`}
              color={def.accent.color}
              value={modules.antiSnipeInitialTax}
              min={MIN_ANTI_SNIPE_TAX_PCT}
              max={MAX_ANTI_SNIPE_TAX_PCT}
              step={1}
              onChange={(v) => onModulesChange({ antiSnipeInitialTax: v })}
            />
            <p className="text-xs leading-relaxed text-zinc-600">
              Snipe tax and window fixed at launch (up to {MAX_ANTI_SNIPE_TAX_PCT}% · {MAX_ANTI_SNIPE_DURATION_SEC}s max).
            </p>
          </div>
        ) : null}

        {selected === "backedFloor" ? (
          <div>
            <FeeRouteSlider
              routeKey="floorAllocation"
              label="Share of hook tax"
              modules={modules}
              color={def.accent.color}
              onModulesChange={onModulesChange}
            />
            <p className="mt-2 font-mono text-[11px]" style={{ color: `${def.accent.color}cc` }}>
              Est. floor ≈ {estimateFloorPrice(modules.floorAllocation, 0).toFixed(6)} ETH / token
            </p>
            <FeeRouteHint modules={modules} />
          </div>
        ) : null}

        {selected === "autoBurn" ? (
          <div>
            <FeeRouteSlider
              routeKey="autoBurnPct"
              label="Share of hook tax"
              modules={modules}
              color={def.accent.color}
              onModulesChange={onModulesChange}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              After the swap, this cut buys the token and burns it. Nested buy skips extra hook tax.
            </p>
            <FeeRouteHint modules={modules} />
          </div>
        ) : null}

        {selected === "lpDonate" ? (
          <div>
            <FeeRouteSlider
              routeKey="lpDonatePct"
              label="Share of hook tax"
              modules={modules}
              color={def.accent.color}
              onModulesChange={onModulesChange}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Uniswap v4 donate to in-range LPs. If no in-range liquidity, the cut falls back to the
              floor vault.
            </p>
            <FeeRouteHint modules={modules} />
          </div>
        ) : null}

        {selected === "holderAirdrop" ? (
          <div>
            <FeeRouteSlider
              routeKey="holderAirdropPct"
              label="Share of hook tax"
              modules={modules}
              color={def.accent.color}
              onModulesChange={onModulesChange}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Quote fees accrue in a vault. Every 15 minutes anyone can push a pro-rata airdrop to
              holders.
            </p>
            <FeeRouteHint modules={modules} />
          </div>
        ) : null}

        {selected === "maxWallet" ? (
          <div>
            <SliderRow
              label="Cap"
              valueLabel={`${formatSupplyCap(modules.maxWalletBps)} supply`}
              color={def.accent.color}
              value={bpsToSupplyPct(modules.maxWalletBps)}
              min={MIN_SUPPLY_CAP_SLIDER_PCT}
              max={MAX_SUPPLY_CAP_SLIDER_PCT}
              step={0.1}
              onChange={(v) => onModulesChange({ maxWalletBps: clampSupplyCapBps(supplyPctToBps(v)) })}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply.
            </p>
          </div>
        ) : null}

        {selected === "maxTx" ? (
          <div>
            <SliderRow
              label="Cap"
              valueLabel={`${formatSupplyCap(modules.maxTxBps)} supply`}
              color={def.accent.color}
              value={bpsToSupplyPct(modules.maxTxBps)}
              min={MIN_SUPPLY_CAP_SLIDER_PCT}
              max={MAX_SUPPLY_CAP_SLIDER_PCT}
              step={0.1}
              onChange={(v) => onModulesChange({ maxTxBps: clampSupplyCapBps(supplyPctToBps(v)) })}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply.
            </p>
          </div>
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

function FeeRouteSlider({
  routeKey,
  label,
  modules,
  color,
  onModulesChange,
}: {
  routeKey: FeeRouteKey;
  label: string;
  modules: LaunchModules;
  color: string;
  onModulesChange: (patch: Partial<LaunchModules>) => void;
}) {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length === 1) {
    return (
      <p className="text-xs leading-relaxed text-zinc-600">100% of hook tax · sole enabled module.</p>
    );
  }

  const value = modules[routeKey];
  return (
    <SliderRow
      label={label}
      valueLabel={`${value}%`}
      color={color}
      value={value}
      min={1}
      max={feeRouteSliderMax(modules, routeKey)}
      step={1}
      onChange={(v) => onModulesChange(setFeeRouteShare(modules, routeKey, v))}
    />
  );
}

function FeeRouteHint({ modules }: { modules: LaunchModules }) {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length <= 1) return null;
  const total = feeRouteTotalPct(modules);
  return (
    <p className={`mt-2 text-xs leading-relaxed ${total !== 100 ? "text-amber-200" : "text-zinc-600"}`}>
      Enabled modules must share exactly 100% of the hook tax (total {total}%).
    </p>
  );
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

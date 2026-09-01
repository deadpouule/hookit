"use client";

import { useCallback, useMemo, useState } from "react";

import { BuilderCircuit } from "@/components/builder/BuilderCircuit";
import { BuilderPalette } from "@/components/builder/BuilderPalette";
import { BuilderTuner } from "@/components/builder/BuilderTuner";
import { BASE_FEE_BPS } from "@/lib/constants";
import { formatBps } from "@/lib/format";
import {
  applyBlockToggle,
  buyOverheadBps,
  enabledLiveBlocks,
  estimateBuyGas,
  feeRoutePct,
  formatGas,
  formatOverhead,
  isBlockEnabled,
  type LiveBlockId,
} from "@/lib/hook-builder";
import { feeRouteIsComplete } from "@/lib/hook-fee-route";
import type { LaunchModules } from "@/lib/types";

type Props = {
  modules: LaunchModules;
  hookTaxBps: number;
  onChange: (next: { modules: LaunchModules; hookTaxBps: number }) => void;
};

export function HookBuilder({ modules, hookTaxBps, onChange }: Props) {
  const [selected, setSelected] = useState<LiveBlockId | null>(
    enabledLiveBlocks(modules, hookTaxBps)[0] ?? null,
  );
  const [soonNote, setSoonNote] = useState<{ label: string; description: string } | null>(null);

  const overhead = useMemo(
    () => buyOverheadBps(modules, hookTaxBps),
    [modules, hookTaxBps],
  );
  const gas = useMemo(
    () => estimateBuyGas(modules, hookTaxBps),
    [modules, hookTaxBps],
  );
  const enabledIds = enabledLiveBlocks(modules, hookTaxBps);
  const routed = feeRoutePct(modules);
  const routeInvalid = !feeRouteIsComplete(modules);
  const openOverflow = overhead.atOpen > 10_000;
  const activeSelected =
    selected && enabledIds.includes(selected) ? selected : (enabledIds[0] ?? null);

  const commit = useCallback(
    (nextModules: LaunchModules, nextTax: number) => {
      onChange({ modules: nextModules, hookTaxBps: nextTax });
    },
    [onChange],
  );

  const toggle = (id: LiveBlockId) => {
    const enabled = isBlockEnabled(id, modules, hookTaxBps);
    const next = applyBlockToggle(id, !enabled, { modules, hookTaxBps });
    commit(next.modules, next.hookTaxBps);
    setSoonNote(null);
    setSelected(!enabled ? id : enabledLiveBlocks(next.modules, next.hookTaxBps)[0] ?? null);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Buy overhead at open"
          value={formatOverhead(overhead.atOpen)}
          hint={
            modules.antiSnipe
              ? `Steady ${formatOverhead(overhead.steady)} after snipe decays`
              : `Base ${formatBps(BASE_FEE_BPS)} + hook tax`
          }
        />
        <Stat label="Est. buy gas" value={formatGas(gas)} hint="From hook snapshots, not a sim" />
        <Stat
          label="Fee route"
          value={`${routed}%`}
          hint={
            routeInvalid
              ? "Shares must total exactly 100%"
              : "100% of hook tax across enabled modules"
          }
        />
      </div>

      {openOverflow ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-100">
          Buy overhead at open is {formatOverhead(overhead.atOpen)}. Anti-snipe + 1% base +
          hook tax cannot exceed 100%. Lower snipe tax or hook tax.
        </p>
      ) : null}

      {routeInvalid ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-100">
          Floor ({modules.backedFloor ? `${modules.floorAllocation}%` : "off"}) + Auto Burn (
          {modules.autoBurn ? `${modules.autoBurnPct}%` : "off"}) + LP Donate (
          {modules.lpDonate ? `${modules.lpDonatePct}%` : "off"}) + Airdrop (
          {modules.holderAirdrop ? `${modules.holderAirdropPct}%` : "off"}) = {routed}%. Adjust
          sliders so the total is exactly 100% before launch.
        </p>
      ) : null}

      <BuilderPalette
        modules={modules}
        hookTaxBps={hookTaxBps}
        selected={soonNote ? null : activeSelected}
        onToggle={toggle}
        onSelectSoon={(label, description) => {
          setSelected(null);
          setSoonNote({ label, description });
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <BuilderCircuit
          modules={modules}
          hookTaxBps={hookTaxBps}
          selected={soonNote ? null : activeSelected}
          onSelect={(id) => {
            setSoonNote(null);
            setSelected(id);
          }}
        />
        <BuilderTuner
          selected={soonNote ? null : activeSelected}
          soonNote={soonNote}
          modules={modules}
          hookTaxBps={hookTaxBps}
          onModulesChange={(patch) => commit({ ...modules, ...patch }, hookTaxBps)}
          onCreatorTaxChange={(bps) => commit(modules, bps)}
          onRemove={(id) => {
            const next = applyBlockToggle(id, false, { modules, hookTaxBps });
            commit(next.modules, next.hookTaxBps);
            setSelected(enabledLiveBlocks(next.modules, next.hookTaxBps)[0] ?? null);
          }}
        />
      </div>

      <details className="gel-surface p-4">
        <summary className="cursor-pointer text-sm text-zinc-300">
          Limits &amp; execution details
          <span className="ml-2 text-xs text-zinc-600">What this cannot do</span>
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-zinc-500">
          <li>
            Block order in the circuit is cosmetic. The hook always runs anti-MEV → max tx →
            snipe tax → quote fee split (floor / auto-burn / LP donate) → max wallet.
          </li>
          <li>
            Anti-MEV is per-origin TSTORE in the same block, not private-mempool protection.
          </li>
          <li>
            Max wallet requires <code className="text-zinc-400">hookData</code> = recipient on buys
            (Hookit router sets this automatically).
          </li>
          <li>
            Floor fill does not catch a single-tick cross of P_floor. Allocation is a split of
            fees, not extra buy overhead. Auto Burn and LP Donate also take a split of that
            quote-fee pool (combined with floor, max 100%).
          </li>
          <li>
            Buy overhead is quote-only: 1% base + hook tax + opening snipe tax. Token output
            is not taxed. Est. gas is a client figure from Foundry snapshots.
          </li>
          <li>
            Custom Solidity launches skip this builder and the master fee stack entirely.
          </li>
        </ul>
      </details>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="gel-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-lg text-zinc-100">{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}

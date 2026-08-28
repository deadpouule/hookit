"use client";

import { ALL_LIVE_BY_ID, enabledLiveBlocks, type LiveBlockId } from "@/lib/hook-builder";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  modules: LaunchModules;
  hookTaxBps: number;
  selected: LiveBlockId | null;
  onSelect: (id: LiveBlockId) => void;
};

export function BuilderCircuit({ modules, hookTaxBps, selected, onSelect }: Props) {
  const active = enabledLiveBlocks(modules, hookTaxBps);

  return (
    <div className="gel-surface overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-200">Your programmable market</p>
          <p className="mt-0.5 text-xs text-zinc-600">One port per behavior · order is fixed on-chain</p>
        </div>
        <p className="font-mono text-[11px] text-zinc-600">
          {active.length} active {active.length === 1 ? "rule" : "rules"}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-center lg:gap-0">
        <CircuitNode label="Start" sub="Buy" tone="in" />
        <Connector />

        {active.length === 0 ? (
          <div className="flex min-h-[92px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6">
            <p className="text-center text-xs leading-relaxed text-zinc-600">
              No custom rules. Buys pay the 1% quote fee, then settle in the v4 pool.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-2">
            {active.map((id) => (
              <CircuitBlock
                key={id}
                id={id}
                selected={selected === id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        <Connector />
        <CircuitNode label="Settle" sub="Pool" tone="out" />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-600">
        A buy hits these rules, then settles in the Uniswap v4 pool via MasterLaunchHook.
        Click a block to tune it.
      </p>
    </div>
  );
}

function CircuitNode({
  label,
  sub,
  tone,
}: {
  label: string;
  sub: string;
  tone: "in" | "out";
}) {
  return (
    <div
      className={cn(
        "flex h-[92px] w-full shrink-0 flex-col items-center justify-center rounded-2xl border px-4 lg:w-[88px]",
        tone === "in"
          ? "border-ink-lavender/30 bg-ink-lavender/8"
          : "border-ink-acid/25 bg-ink-acid/8",
      )}
    >
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="mt-0.5 text-sm font-medium text-zinc-100">{sub}</span>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex h-6 w-full items-center justify-center lg:h-auto lg:w-6" aria-hidden>
      <div className="h-6 w-px bg-white/10 lg:h-px lg:w-full" />
    </div>
  );
}

function CircuitBlock({
  id,
  selected,
  onSelect,
}: {
  id: LiveBlockId;
  selected: boolean;
  onSelect: (id: LiveBlockId) => void;
}) {
  const def = ALL_LIVE_BY_ID[id];
  const Icon = def.accent.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[92px] w-full flex-1 flex-col items-start justify-center rounded-2xl border px-3 py-3 text-left transition",
        selected ? "bg-black/40" : "bg-black/25 hover:bg-black/40",
      )}
      style={{
        borderColor: selected ? def.accent.color : `${def.accent.color}55`,
        ...(selected ? { boxShadow: `0 0 28px -12px ${def.accent.glow}` } : {}),
      }}
    >
      <span
        className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full"
        style={{ background: def.accent.color }}
      />
      <span
        className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
        style={{ background: def.accent.color, opacity: 0.45 }}
      />
      <span
        className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full"
        style={{ background: def.accent.color, opacity: 0.45 }}
      />
      <span
        className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full"
        style={{ background: def.accent.color, opacity: 0.45 }}
      />
      <Icon className="mb-1.5 h-3.5 w-3.5" style={{ color: def.accent.color }} />
      <span className="text-xs font-medium text-zinc-100">{def.label}</span>
      <span className="mt-0.5 text-[10px] text-zinc-500">{def.short}</span>
    </button>
  );
}

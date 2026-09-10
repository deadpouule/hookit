"use client";

import { cn } from "@/lib/utils";
import {
  DEFAULT_MCAP_STEP_PCT,
  formatMcapPreset,
  type McapUnlockMode,
} from "@/lib/mcap-vest";

export function McapUnlockPicker({
  theme,
  untilMcap,
  mode,
  cliffUsd,
  presets,
  stepUsd,
  stepPct,
  onUntilMcap,
  onMode,
  onCliff,
  onStepPct,
  untilLabel = "Until mcap",
}: {
  theme: string;
  untilMcap: boolean;
  mode: McapUnlockMode;
  cliffUsd: number;
  presets: readonly number[];
  stepUsd: readonly number[];
  stepPct: number[];
  onUntilMcap: (next: boolean) => void;
  onMode: (mode: McapUnlockMode) => void;
  onCliff: (usd: number) => void;
  onStepPct: (pct: number[]) => void;
  untilLabel?: string;
}) {
  const pct = stepPct.length === 6 ? stepPct : [...DEFAULT_MCAP_STEP_PCT];
  const sum = pct.reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="launch-mode-toggle launch-mode-toggle--compact" role="tablist" aria-label="Unlock condition">
        {(
          [
            { value: false, label: "Time" },
            { value: true, label: untilLabel },
          ] as const
        ).map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={untilMcap === opt.value}
            onClick={() => onUntilMcap(opt.value)}
            className={cn(
              "launch-mode-toggle__btn launch-mode-toggle__btn--single",
              untilMcap === opt.value && "is-active",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {untilMcap ? (
        <>
          <div className="launch-mode-toggle launch-mode-toggle--compact" role="tablist" aria-label="Unlock amount">
            {(
              [
                { value: "all" as const, label: "All unlock" },
                { value: "steps" as const, label: "By %" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={mode === opt.value}
                onClick={() => onMode(opt.value)}
                className={cn(
                  "launch-mode-toggle__btn launch-mode-toggle__btn--single",
                  mode === opt.value && "is-active",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === "all" ? (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((usd) => (
                <button
                  key={usd}
                  type="button"
                  onClick={() => onCliff(usd)}
                  className={cn(
                    "orb-hook-desc-badge pick-config-hint-badge",
                    `orb-hook-desc-badge--${theme}`,
                    cliffUsd === usd && "is-active",
                  )}
                  style={
                    cliffUsd === usd
                      ? { outline: "1px solid currentColor", fontWeight: 700 }
                      : undefined
                  }
                >
                  {formatMcapPreset(usd)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {stepUsd.map((usd, i) => (
                <label key={usd} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                  <span>{formatMcapPreset(usd)}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={pct[i] ?? 0}
                      onChange={(e) => {
                        const next = [...pct];
                        next[i] = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        onStepPct(next);
                      }}
                      className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-right text-white"
                    />
                    <span className="text-zinc-500">%</span>
                  </span>
                </label>
              ))}
              <span className={cn("text-[11px]", sum === 100 ? "text-zinc-500" : "text-rose-400")}>
                {sum === 100 ? "Unlocks add to 100%" : `Unlocks sum to ${sum}% — need 100%`}
              </span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import {
  EMPTY_MCAP_STEP_PCT,
  formatMcapPreset,
  type McapUnlockMode,
} from "@/lib/mcap-vest";

function HookChoiceBadge({
  theme,
  active,
  children,
  onClick,
  ariaPressed,
}: {
  theme: string;
  active: boolean;
  children: string;
  onClick: () => void;
  ariaPressed: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={cn(
        "orb-hook-desc-badge pick-config-control-badge mcap-choice-badge",
        `orb-hook-desc-badge--${theme}`,
        active && "is-picked",
      )}
    >
      {children}
    </button>
  );
}

function ChoiceOr({ theme }: { theme: string }) {
  return (
    <span className={cn("mcap-choice-or", `orb-hook-desc-badge--${theme}`)} aria-hidden>
      or
    </span>
  );
}

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
  const pct = stepPct.length === 6 ? stepPct : [...EMPTY_MCAP_STEP_PCT];
  const sum = pct.reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="mcap-choice-row" role="group" aria-label="Unlock condition">
        <HookChoiceBadge theme={theme} active={!untilMcap} ariaPressed={!untilMcap} onClick={() => onUntilMcap(false)}>
          Time
        </HookChoiceBadge>
        <ChoiceOr theme={theme} />
        <HookChoiceBadge theme={theme} active={untilMcap} ariaPressed={untilMcap} onClick={() => onUntilMcap(true)}>
          {untilLabel}
        </HookChoiceBadge>
      </div>

      {untilMcap ? (
        <>
          <div className="mcap-choice-row" role="group" aria-label="Unlock amount">
            <HookChoiceBadge
              theme={theme}
              active={mode === "all"}
              ariaPressed={mode === "all"}
              onClick={() => onMode("all")}
            >
              All unlock
            </HookChoiceBadge>
            <ChoiceOr theme={theme} />
            <HookChoiceBadge
              theme={theme}
              active={mode === "steps"}
              ariaPressed={mode === "steps"}
              onClick={() => onMode("steps")}
            >
              By %
            </HookChoiceBadge>
          </div>

          {mode === "all" ? (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((usd) => (
                <button
                  key={usd}
                  type="button"
                  onClick={() => onCliff(usd)}
                  className={cn(
                    "orb-hook-desc-badge pick-config-control-badge mcap-choice-badge",
                    `orb-hook-desc-badge--${theme}`,
                    cliffUsd === usd && "is-picked",
                  )}
                >
                  {formatMcapPreset(usd)}
                </button>
              ))}
            </div>
          ) : (
            <div className="mcap-step-list">
              <div className="mcap-step-grid">
                {stepUsd.map((usd, i) => (
                  <label key={usd} className="mcap-step-col">
                    <span
                      className={cn(
                        "orb-hook-desc-badge pick-config-control-badge mcap-choice-badge",
                        `orb-hook-desc-badge--${theme}`,
                      )}
                    >
                      {formatMcapPreset(usd)}
                    </span>
                    <span
                      className={cn(
                        "pick-config-control-value pick-config-control-value--edit orb-hook-desc-badge mcap-step-pct-box",
                        `orb-hook-desc-badge--${theme}`,
                      )}
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        aria-label={`${formatMcapPreset(usd)} unlock percent`}
                        placeholder=""
                        value={pct[i] ? String(pct[i]) : ""}
                        onChange={(e) => {
                          const next = [...pct];
                          const raw = e.target.value;
                          next[i] = raw === "" ? 0 : Math.max(0, Math.min(100, Number(raw) || 0));
                          onStepPct(next);
                        }}
                        className="pick-config-value-input mcap-step-pct-input"
                      />
                      <span className="pick-config-value-suffix">%</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className={cn("pick-config-hint", sum !== 100 && "pick-config-hint--warn")}>
                {sum === 100 ? "Unlocks add to 100%" : `Unlocks sum to ${sum}%. Need 100%`}
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

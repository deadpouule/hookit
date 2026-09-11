"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { HookDetailPanel } from "@/components/explore/HookDetailPanel";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { HookLogo } from "@/components/home/market/HookLogo";
import { AccentSlider } from "@/components/launch/AccentSlider";
import { McapUnlockPicker } from "@/components/launch/McapUnlockPicker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hookPickTagline, isModuleEnabled } from "@/lib/launch-module-summary";
import { creatorCutLock } from "@/lib/launch-wizard";
import {
  BASE_FEE_BPS,
  BUYBACK_VESTING_DEFAULT_DAYS,
  BUYBACK_VESTING_MAX_DAYS,
  BUYBACK_VESTING_MCAP_DEFAULT_USD,
  BUYBACK_VESTING_MIN_DAYS,
  HOLDER_AIRDROP_MCAP_DEFAULT_USD,
  DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS,
  MAX_HOOK_TAX_BPS,
  MAX_TOTAL_FEE_BPS,
} from "@/lib/constants";
import { formatBps } from "@/lib/format";
import {
  AIRDROP_MCAP_PRESET_USD,
  AIRDROP_STEP_PRESET_USD,
  BUYBACK_MCAP_PRESET_USD,
  BUYBACK_STEP_PRESET_USD,
  DEFAULT_MCAP_STEP_PCT,
} from "@/lib/mcap-vest";
import {
  clampDynamicFeeRange,
  formatTotalFeePercent,
  resolveDynamicFeeMaxBps,
  resolveDynamicFeeMinBps,
} from "@/lib/fee-range";
import {
  clampSupplyCapBps,
  MAX_ANTI_SNIPE_DURATION_SEC,
  MAX_ANTI_SNIPE_TAX_PCT,
  MAX_SUPPLY_CAP_SLIDER_PCT,
  MIN_ANTI_SNIPE_DURATION_SEC,
  MIN_ANTI_SNIPE_TAX_PCT,
  MIN_SUPPLY_CAP_SLIDER_PCT,
  HOLDER_AIRDROP_EPOCH_MINUTES,
  HOLDER_AIRDROP_EPOCH_MAX_MINUTES,
  HOLDER_AIRDROP_EPOCH_DEFAULT_MINUTES,
  DYNAMIC_FEE_MAX_DEPTH_SATURATION_PCT,
  DYNAMIC_FEE_MIN_DEPTH_SATURATION_PCT,
  bpsToSupplyPct,
  formatSupplyCap,
  supplyPctToBps,
} from "@/lib/protocol-limits";
import {
  feeRouteSliderMax,
  feeRouteTotalPct,
  listEnabledFeeRoutes,
  setFeeRouteShare,
  type FeeRouteKey,
} from "@/lib/hook-fee-route";
import {
  hookAccentColor,
  hookThemeAccentColor,
  MASTER_HOOKS,
  type HookTheme,
  type MasterHook,
  type MasterHookId,
} from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_CONFIG_HOOKS = new Set<MasterHookId>(["anti-mev"]);
const FIXED_FEE_THEME: HookTheme = "rose";
const DEFAULT_FIXED_FEE_BPS = 50;
type PickerFocusId = MasterHookId | "fixed-fee";

type ConfigPreset = { value: number; label: string };

const ANTI_SNIPE_DURATION_PRESETS: readonly ConfigPreset[] = [
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
];

const ANTI_SNIPE_TAX_PRESETS: readonly ConfigPreset[] = [
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
  { value: 50, label: "50%" },
  { value: 90, label: "90%" },
];

const SUPPLY_CAP_PRESETS: readonly ConfigPreset[] = [
  { value: 0.2, label: "0.2%" },
  { value: 0.5, label: "0.5%" },
  { value: 1, label: "1%" },
  { value: 2, label: "2%" },
];

const FIXED_FEE_PRESETS: readonly ConfigPreset[] = [
  { value: 1, label: "1%" },
  { value: 3, label: "3%" },
  { value: 5, label: "5%" },
  { value: 8, label: "8%" },
];

const DYNAMIC_FEE_MIN_PRESETS: readonly ConfigPreset[] = [
  { value: 1, label: "1%" },
  { value: 2, label: "2%" },
  { value: 3, label: "3%" },
  { value: 5, label: "5%" },
];

const DYNAMIC_FEE_MAX_PRESETS: readonly ConfigPreset[] = [
  { value: 3, label: "3%" },
  { value: 5, label: "5%" },
  { value: 8, label: "8%" },
  { value: 10, label: "10%" },
];

function valuesMatch(a: number, b: number, step: number): boolean {
  return Math.abs(a - b) <= Math.max(step / 2, 1e-9);
}

function ConfigHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("pick-config-hint", className)}>{children}</p>;
}

function FixedFeePickCard({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "pick-card pick-card--hook",
        `pick-card--${FIXED_FEE_THEME}`,
        selected && "is-on",
      )}
      onClick={onClick}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="About fixed fees"
            className="hook-pick-tooltip-trigger"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Info className="h-3 w-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="max-w-[260px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
        >
          Flat extra fee on every swap — deducted in quote only, zero sell pressure on your token.
          Leftover fees route to the protocol.
        </TooltipContent>
      </Tooltip>
      <div className="pick-card-mark pick-ascii">
        <HookLogo hookId="fixed-fee" theme={FIXED_FEE_THEME} />
      </div>
      <p className="pick-card-title">fixed fees</p>
      <p className="pick-card-sub pick-card-sub--hook">Flat hook tax</p>
    </button>
  );
}

function FixedFeeConfigPanel({
  active,
  hookTaxBps,
  onHookTaxBpsChange,
}: {
  active: boolean;
  hookTaxBps: number;
  onHookTaxBpsChange: (bps: number) => void;
}) {
  const accent = hookThemeAccentColor(FIXED_FEE_THEME);

  return (
    <>
      <div className={cn("pick-config-head", active && "pick-config-head--focused")}>
        <div className="pick-config-head-copy">
          <div className="pick-config-head-row">
            <h2
              className={cn(
                "orb-hook-desc-badge orb-hook-title-badge pick-config-badge",
                `orb-hook-desc-badge--${FIXED_FEE_THEME}`,
              )}
            >
              <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
              <span>Fixed Fees</span>
            </h2>
          </div>
        </div>
        <div className="pick-config-ascii" aria-hidden>
          <HookLogo hookId="fixed-fee" theme={FIXED_FEE_THEME} />
        </div>
      </div>
      <PickConfigControl
        theme={FIXED_FEE_THEME}
        label="Hook fee"
        value={formatBps(hookTaxBps)}
        presets={FIXED_FEE_PRESETS}
        edit={{
          numericValue: hookTaxBps / 100,
          min: 0,
          max: MAX_HOOK_TAX_BPS / 100,
          step: 0.1,
          suffix: "%",
          onCommit: (pct) => onHookTaxBpsChange(Math.round(pct * 100)),
        }}
      >
        <AccentSlider
          accentColor={accent}
          value={[hookTaxBps]}
          onValueChange={([v]) => onHookTaxBpsChange(v)}
          min={0}
          max={MAX_HOOK_TAX_BPS}
          step={10}
        />
      </PickConfigControl>
      <ConfigHint>Extra fee for hook modules · leftover → protocol</ConfigHint>
    </>
  );
}

function HookPickTooltip({ hook }: { hook: MasterHook }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${hook.title}`}
          className="hook-pick-tooltip-trigger"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="hook-settings-tooltip border-0 bg-transparent p-0 shadow-none"
      >
        <HookDetailPanel hook={hook} />
      </TooltipContent>
    </Tooltip>
  );
}

function HookPickCard({
  hook,
  selected,
  disabled = false,
  disabledHint,
  disabledDetail,
  onClick,
}: {
  hook: MasterHook;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  disabledDetail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      title={disabled ? disabledDetail ?? disabledHint : undefined}
      className={cn(
        "pick-card pick-card--hook",
        `pick-card--${hook.theme}`,
        selected && "is-on",
        disabled && "cursor-not-allowed opacity-45",
      )}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
    >
      <HookPickTooltip hook={hook} />
      <div className="pick-card-mark pick-ascii">
        <HookLogo hookId={hook.id} theme={hook.theme} />
      </div>
      <p className="pick-card-title">{hook.title}</p>
      <p className="pick-card-sub pick-card-sub--hook">
        {disabled && disabledHint ? disabledHint : hookPickTagline(hook.id)}
      </p>
    </button>
  );
}

function parseTypedNumber(raw: string): number | null {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const scaled = Math.round(value / step) * step;
  const decimals = String(step).includes(".") ? (String(step).split(".")[1]?.length ?? 0) : 0;
  return Number(scaled.toFixed(decimals));
}

function formatEditableNumber(value: number, step: number): string {
  return String(snapToStep(value, step));
}

function PickConfigControl({
  theme,
  label,
  value,
  children,
  edit,
  presets,
}: {
  theme: HookTheme;
  label?: string;
  value: string;
  children: ReactNode;
  presets?: readonly ConfigPreset[];
  edit?: {
    numericValue: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    onCommit: (next: number) => void;
  };
}) {
  const step = edit?.step ?? 1;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() =>
    edit ? formatEditableNumber(edit.numericValue, step) : "",
  );
  const matchedPreset =
    edit && presets ? presets.find((preset) => valuesMatch(edit.numericValue, preset.value, step)) : undefined;
  const hideCustomValue = Boolean(presets && matchedPreset && !focused);

  useEffect(() => {
    if (!edit || focused) return;
    setDraft(formatEditableNumber(edit.numericValue, step));
  }, [edit, focused, step]);

  const applyDraft = (raw: string, finalize: boolean) => {
    if (!edit) return;
    const parsed = parseTypedNumber(raw);
    if (parsed == null) {
      if (finalize) setDraft(formatEditableNumber(edit.numericValue, step));
      return;
    }
    if (!finalize && parsed < edit.min) return;
    const next = snapToStep(Math.min(edit.max, Math.max(edit.min, parsed)), step);
    if (parsed > edit.max || finalize) setDraft(formatEditableNumber(next, step));
    if (next !== edit.numericValue) edit.onCommit(next);
  };

  const commitPreset = (presetValue: number) => {
    if (!edit) return;
    const next = snapToStep(Math.min(edit.max, Math.max(edit.min, presetValue)), step);
    if (next !== edit.numericValue) edit.onCommit(next);
  };

  const valueEditor = edit ? (
    <label
      className={cn(
        "pick-config-control-value pick-config-control-value--edit orb-hook-desc-badge",
        `orb-hook-desc-badge--${theme}`,
        presets && "pick-preset-custom",
        presets && !matchedPreset && "is-picked",
        hideCustomValue && "is-empty",
      )}
    >
      <input
        className="pick-config-value-input"
        inputMode="decimal"
        autoComplete="off"
        aria-label={presets ? `${label ?? "Value"} custom` : (label ?? "Value")}
        style={{
          width: `${Math.max(String(Math.floor(edit.max)).length, 2) + (step < 1 ? 2 : 0) + 1}ch`,
        }}
        value={
          hideCustomValue ? "" : focused ? draft : formatEditableNumber(edit.numericValue, step)
        }
        onFocus={(event) => {
          setFocused(true);
          setDraft(formatEditableNumber(edit.numericValue, step));
          event.currentTarget.select();
        }}
        onBlur={() => {
          applyDraft(draft, true);
          setFocused(false);
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,]/g, "");
          setDraft(next);
          applyDraft(next, false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {edit.suffix && !hideCustomValue ? (
        <span className="pick-config-value-suffix">{edit.suffix}</span>
      ) : null}
    </label>
  ) : (
    <span
      className={cn(
        "pick-config-control-value orb-hook-desc-badge",
        `orb-hook-desc-badge--${theme}`,
      )}
    >
      {value}
    </span>
  );

  return (
    <div className="pick-config-control">
      <div
        className={cn(
          "pick-config-control-head",
          !label && "pick-config-control-head--value-only",
        )}
      >
        {label ? (
          <span
            className={cn(
              "pick-config-control-badge orb-hook-desc-badge",
              `orb-hook-desc-badge--${theme}`,
            )}
          >
            {label}
          </span>
        ) : null}
        {presets ? null : valueEditor}
      </div>
      <div className="pick-config-control-track">{children}</div>
      {presets && edit ? (
        <div className="pick-preset-row" role="group" aria-label={label ? `${label} presets` : "Presets"}>
          {presets.map((preset) => {
            const active = valuesMatch(edit.numericValue, preset.value, step);
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => commitPreset(preset.value)}
                className={cn(
                  "orb-hook-desc-badge pick-config-control-badge pick-preset-badge",
                  `orb-hook-desc-badge--${theme}`,
                  active && "is-picked",
                )}
              >
                {preset.label}
              </button>
            );
          })}
          {valueEditor}
        </div>
      ) : null}
    </div>
  );
}

export function HookModulePicker({
  modules,
  onToggle,
  onUpdate,
  onHookTaxChange,
  floorEst,
  multiMarket = false,
  hookTaxBps = 0,
  onHookTaxBpsChange,
  hookIds,
  heading = "Pick your hooks",
  includeFixedFee = false,
  configLayout = "stack",
  configHeading,
}: {
  modules: LaunchModules;
  onToggle: (id: MasterHookId, next: boolean) => void;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  onHookTaxChange?: (hookTaxBps: number) => void;
  floorEst: number;
  multiMarket?: boolean;
  hookTaxBps?: number;
  onHookTaxBpsChange?: (bps: number) => void;
  hookIds?: MasterHookId[];
  heading?: string;
  includeFixedFee?: boolean;
  configLayout?: "stack" | "aside";
  configHeading?: string;
}) {
  const panelRefs = useRef<Partial<Record<PickerFocusId, HTMLDivElement | null>>>({});
  const visibleHooks = hookIds
    ? MASTER_HOOKS.filter((hook) => hookIds.includes(hook.id))
    : MASTER_HOOKS;
  const enabledHooks = visibleHooks.filter((h) => isModuleEnabled(modules, h.id));
  const fixedFeeEnabled = includeFixedFee && hookTaxBps > 0 && !modules.dynamicFees;
  const [focus, setFocus] = useState<PickerFocusId | null>(
    enabledHooks[0]?.id ?? (fixedFeeEnabled ? "fixed-fee" : null),
  );

  useEffect(() => {
    if (focus === "fixed-fee" && fixedFeeEnabled) return;
    if (focus && enabledHooks.some((h) => h.id === focus)) return;
    setFocus(enabledHooks[0]?.id ?? (fixedFeeEnabled ? "fixed-fee" : null));
  }, [enabledHooks, fixedFeeEnabled, focus]);

  useEffect(() => {
    const observed: PickerFocusId[] = [...enabledHooks.map((h) => h.id)];
    if (fixedFeeEnabled) observed.push("fixed-fee");
    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const id = top.target.getAttribute("data-hook-id") as PickerFocusId | null;
        if (id) setFocus(id);
      },
      {
        root: null,
        rootMargin: "-28% 0px -38% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      },
    );

    for (const id of observed) {
      const el = panelRefs.current[id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [enabledHooks, fixedFeeEnabled]);

  const scrollToPanel = (id: PickerFocusId) => {
    setFocus(id);
    requestAnimationFrame(() => {
      panelRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const toggleFixedFee = () => {
    const applyHookTax = (bps: number) => {
      onHookTaxBpsChange?.(bps);
      onHookTaxChange?.(bps);
    };
    if (!onHookTaxBpsChange && !onHookTaxChange) return;
    if (fixedFeeEnabled) {
      applyHookTax(0);
      const next = enabledHooks[0]?.id ?? null;
      setFocus(next);
      return;
    }
    onUpdate({ dynamicFees: false });
    applyHookTax(DEFAULT_FIXED_FEE_BPS);
    scrollToPanel("fixed-fee");
  };

  const renderPickCards = () =>
    visibleHooks.flatMap((hook) => {
      const selected = isModuleEnabled(modules, hook.id);
      const cutLock = creatorCutLock(hook.id, modules);
      const disabled = (multiMarket && hook.id === "backed-floor") || Boolean(cutLock);
      const disabledHint =
        multiMarket && hook.id === "backed-floor"
          ? "Unavailable on multi-pair"
          : cutLock?.card;
      const cards = [
        <HookPickCard
          key={hook.id}
          hook={hook}
          selected={selected}
          disabled={disabled}
          disabledHint={disabledHint}
          disabledDetail={cutLock?.detail}
          onClick={() => {
            if (disabled) return;
            if (selected) {
              onToggle(hook.id, false);
              const next = enabledHooks.find((item) => item.id !== hook.id);
              setFocus(next?.id ?? (fixedFeeEnabled ? "fixed-fee" : null));
              return;
            }
            onToggle(hook.id, true);
            scrollToPanel(hook.id);
          }}
        />,
      ];

      if (includeFixedFee && hook.id === "dynamic-fees") {
        cards.push(
          <FixedFeePickCard
            key="fixed-fee"
            selected={fixedFeeEnabled}
            onClick={toggleFixedFee}
          />,
        );
      }

      return cards;
    });

  const configPanelIds: PickerFocusId[] = [
    ...enabledHooks.flatMap((hook) => {
      const ids: PickerFocusId[] = [hook.id];
      if (includeFixedFee && fixedFeeEnabled && hook.id === "dynamic-fees") {
        ids.push("fixed-fee");
      }
      return ids;
    }),
    ...(includeFixedFee && fixedFeeEnabled && !enabledHooks.some((h) => h.id === "dynamic-fees")
      ? (["fixed-fee"] as const)
      : []),
  ];

  const visibleConfigIds =
    configLayout === "aside" && focus
      ? configPanelIds.filter((id) => id === focus)
      : configPanelIds;

  const configPanels =
    visibleConfigIds.length > 0 ? (
      <div
        className={cn(
          configLayout === "aside"
            ? "launch-wizard-hook-config space-y-3 lg:sticky lg:top-20"
            : "mt-5 space-y-3",
        )}
      >
        {configLayout === "stack" ? (
          configHeading ? (
            <p className="pick-heading">{configHeading}</p>
          ) : (
            <p className="text-xs text-zinc-500">
              All active modules — settings stay visible when you switch focus.
            </p>
          )
        ) : (
          <p className="text-xs text-zinc-500">Active module settings</p>
        )}
        {visibleConfigIds.map((panelId) => {
          if (panelId === "fixed-fee") {
            return (
              <div
                key="fixed-fee"
                data-hook-id="fixed-fee"
                ref={(el) => {
                  panelRefs.current["fixed-fee"] = el;
                }}
                className={cn(
                  "pick-config pick-config--panel transition-shadow",
                  `pick-config--${FIXED_FEE_THEME}`,
                  focus === "fixed-fee" && "pick-config--focused",
                )}
              >
                <FixedFeeConfigPanel
                  active={focus === "fixed-fee"}
                  hookTaxBps={hookTaxBps}
                  onHookTaxBpsChange={(bps) => {
                    onHookTaxBpsChange?.(bps);
                    onHookTaxChange?.(bps);
                  }}
                />
              </div>
            );
          }

          const hook = enabledHooks.find((item) => item.id === panelId);
          if (!hook) return null;

          return (
            <div
              key={hook.id}
              data-hook-id={hook.id}
              ref={(el) => {
                panelRefs.current[hook.id] = el;
              }}
              className={cn(
                "pick-config pick-config--panel transition-shadow",
                `pick-config--${hook.theme}`,
                focus === hook.id && "pick-config--focused",
              )}
            >
              <HookConfigHeader
                hook={hook}
                active={focus === hook.id}
                modules={modules}
                hookTaxBps={hookTaxBps}
              />
              <HookSettings
                hook={hook}
                modules={modules}
                onUpdate={onUpdate}
                onHookTaxChange={onHookTaxChange}
                floorEst={floorEst}
                hookTaxBps={hookTaxBps}
                multiMarket={multiMarket}
              />
            </div>
          );
        })}
      </div>
    ) : configLayout === "aside" ? (
      <div className="launch-wizard-hook-config launch-wizard-hook-config--empty lg:sticky lg:top-20">
        <p className="text-xs leading-relaxed text-zinc-500">
          Select a hook to configure its settings here.
        </p>
      </div>
    ) : null;

  return (
    <div className={cn(configLayout === "aside" && "launch-wizard-hook-picker")}>
      <p className="pick-heading">{heading}</p>
      <div
        className={cn(
          configLayout === "aside" &&
            "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]",
        )}
      >
        <div className="pick-grid pick-grid--hooks pick-grid--hooks-wizard">{renderPickCards()}</div>
        {configPanels}
      </div>
    </div>
  );
}

function HookConfigHeader({
  hook,
  active,
  modules,
  hookTaxBps = 0,
}: {
  hook: MasterHook;
  active: boolean;
  modules: LaunchModules;
  hookTaxBps?: number;
}) {
  return (
    <div className={cn("pick-config-head", active && "pick-config-head--focused")}>
      <div className="pick-config-head-copy">
        <div className="pick-config-head-row">
          <h2
            className={cn(
              "orb-hook-desc-badge orb-hook-title-badge pick-config-badge",
              `orb-hook-desc-badge--${hook.theme}`,
            )}
          >
            <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
            <span>{hook.title}</span>
          </h2>
          <HookSettingsTooltip hook={hook} modules={modules} hookTaxBps={hookTaxBps} />
        </div>
      </div>
      <div className="pick-config-ascii" aria-hidden>
        <HookLogo hookId={hook.id} theme={hook.theme} />
      </div>
    </div>
  );
}

function HookSettings({
  hook,
  modules,
  onUpdate,
  onHookTaxChange,
  floorEst,
  hookTaxBps = 0,
  multiMarket = false,
}: {
  hook: MasterHook;
  modules: LaunchModules;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  onHookTaxChange?: (hookTaxBps: number) => void;
  floorEst: number;
  hookTaxBps?: number;
  multiMarket?: boolean;
}) {
  const accent = hookAccentColor(hook.id);
  const theme = hook.theme;

  if (NO_CONFIG_HOOKS.has(hook.id)) {
    return null;
  }

  if (hook.id === "anti-snipe") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
        <PickConfigControl
          theme={theme}
          label="Duration"
          value={`${modules.antiSnipeDuration}s`}
          presets={ANTI_SNIPE_DURATION_PRESETS}
          edit={{
            numericValue: modules.antiSnipeDuration,
            min: MIN_ANTI_SNIPE_DURATION_SEC,
            max: MAX_ANTI_SNIPE_DURATION_SEC,
            step: 1,
            suffix: "s",
            onCommit: (next) => onUpdate({ antiSnipeDuration: next }),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[modules.antiSnipeDuration]}
            onValueChange={([v]) => onUpdate({ antiSnipeDuration: v })}
            min={MIN_ANTI_SNIPE_DURATION_SEC}
            max={MAX_ANTI_SNIPE_DURATION_SEC}
            step={1}
          />
        </PickConfigControl>
        </div>
        <div className="sm:col-span-2">
        <PickConfigControl
          theme={theme}
          label="Initial tax"
          value={`${modules.antiSnipeInitialTax}%`}
          presets={ANTI_SNIPE_TAX_PRESETS}
          edit={{
            numericValue: modules.antiSnipeInitialTax,
            min: MIN_ANTI_SNIPE_TAX_PCT,
            max: MAX_ANTI_SNIPE_TAX_PCT,
            step: 1,
            suffix: "%",
            onCommit: (next) => onUpdate({ antiSnipeInitialTax: next }),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[modules.antiSnipeInitialTax]}
            onValueChange={([v]) => onUpdate({ antiSnipeInitialTax: v })}
            min={MIN_ANTI_SNIPE_TAX_PCT}
            max={MAX_ANTI_SNIPE_TAX_PCT}
            step={1}
          />
        </PickConfigControl>
        </div>
        <ConfigHint className="sm:col-span-2">
          Snipe tax and window are fixed at launch (up to {MAX_ANTI_SNIPE_TAX_PCT}% · {MAX_ANTI_SNIPE_DURATION_SEC}s max)
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "backed-floor") {
    const routeKey: FeeRouteKey = "floorAllocation";
    return (
      <div>
        <FeeRouteShareControl
          routeKey={routeKey}
          modules={modules}
          theme={theme}
          accent={accent}
          onUpdate={onUpdate}
        />
        {floorEst > 0 && (
          <ConfigHint>Est. floor ≈ {floorEst.toFixed(6)} ETH / token</ConfigHint>
        )}
        {multiMarket && (
          <ConfigHint>Backed floor is single-pair only — switch to one market to enable</ConfigHint>
        )}
      </div>
    );
  }

  if (hook.id === "max-wallet") {
    return (
      <div>
        <PickConfigControl
          theme={theme}
          label="Per wallet"
          value={`${formatSupplyCap(modules.maxWalletBps)} of supply`}
          presets={SUPPLY_CAP_PRESETS}
          edit={{
            numericValue: bpsToSupplyPct(modules.maxWalletBps),
            min: MIN_SUPPLY_CAP_SLIDER_PCT,
            max: MAX_SUPPLY_CAP_SLIDER_PCT,
            step: 0.1,
            suffix: "%",
            onCommit: (pct) => onUpdate({ maxWalletBps: clampSupplyCapBps(supplyPctToBps(pct)) }),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[bpsToSupplyPct(modules.maxWalletBps)]}
            onValueChange={([v]) => onUpdate({ maxWalletBps: clampSupplyCapBps(supplyPctToBps(v)) })}
            min={MIN_SUPPLY_CAP_SLIDER_PCT}
            max={MAX_SUPPLY_CAP_SLIDER_PCT}
            step={0.1}
          />
        </PickConfigControl>
        <ConfigHint>
          Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "max-tx") {
    return (
      <div>
        <PickConfigControl
          theme={theme}
          label="Per swap"
          value={`${formatSupplyCap(modules.maxTxBps)} of supply`}
          presets={SUPPLY_CAP_PRESETS}
          edit={{
            numericValue: bpsToSupplyPct(modules.maxTxBps),
            min: MIN_SUPPLY_CAP_SLIDER_PCT,
            max: MAX_SUPPLY_CAP_SLIDER_PCT,
            step: 0.1,
            suffix: "%",
            onCommit: (pct) => onUpdate({ maxTxBps: clampSupplyCapBps(supplyPctToBps(pct)) }),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[bpsToSupplyPct(modules.maxTxBps)]}
            onValueChange={([v]) => onUpdate({ maxTxBps: clampSupplyCapBps(supplyPctToBps(v)) })}
            min={MIN_SUPPLY_CAP_SLIDER_PCT}
            max={MAX_SUPPLY_CAP_SLIDER_PCT}
            step={0.1}
          />
        </PickConfigControl>
        <ConfigHint>
          Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "dynamic-fees") {
    const minBps = resolveDynamicFeeMinBps(modules);
    const maxBps = resolveDynamicFeeMaxBps(modules, hookTaxBps);

    const applyRange = (nextMin: number, nextMax: number) => {
      const clamped = clampDynamicFeeRange(nextMin, nextMax);
      onUpdate({
        dynamicFeeMinBps: clamped.dynamicFeeMinBps,
        dynamicFeeMaxBps: clamped.dynamicFeeMaxBps,
      });
      onHookTaxChange?.(clamped.hookTaxBps);
    };

    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <PickConfigControl
          theme={theme}
          label="Min total fee"
          value={formatTotalFeePercent(minBps)}
          presets={DYNAMIC_FEE_MIN_PRESETS}
          edit={{
            numericValue: minBps / 100,
            min: BASE_FEE_BPS / 100,
            max: (MAX_TOTAL_FEE_BPS - 10) / 100,
            step: 0.1,
            suffix: "%",
            onCommit: (pct) => applyRange(Math.round(pct * 100), maxBps),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[minBps]}
            onValueChange={([v]) => applyRange(v, maxBps)}
            min={BASE_FEE_BPS}
            max={MAX_TOTAL_FEE_BPS - 10}
            step={10}
          />
        </PickConfigControl>
        <PickConfigControl
          theme={theme}
          label="Max total fee"
          value={formatTotalFeePercent(maxBps)}
          presets={DYNAMIC_FEE_MAX_PRESETS}
          edit={{
            numericValue: maxBps / 100,
            min: (BASE_FEE_BPS + 10) / 100,
            max: MAX_TOTAL_FEE_BPS / 100,
            step: 0.1,
            suffix: "%",
            onCommit: (pct) => applyRange(minBps, Math.round(pct * 100)),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[maxBps]}
            onValueChange={([v]) => applyRange(minBps, v)}
            min={BASE_FEE_BPS + 10}
            max={MAX_TOTAL_FEE_BPS}
            step={10}
          />
        </PickConfigControl>
        <PickConfigControl
          theme={theme}
          label="Depth % for max fee"
          value={`${Math.round((modules.dynamicFeeDepthSaturationBps ?? DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS) / 100)}%`}
          edit={{
            numericValue: Math.round(
              (modules.dynamicFeeDepthSaturationBps ?? DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS) / 100,
            ),
            min: DYNAMIC_FEE_MIN_DEPTH_SATURATION_PCT,
            max: DYNAMIC_FEE_MAX_DEPTH_SATURATION_PCT,
            step: 5,
            suffix: "%",
            onCommit: (pct) => onUpdate({ dynamicFeeDepthSaturationBps: Math.round(pct * 100) }),
          }}
        >
          <AccentSlider
            accentColor={accent}
            value={[
              (modules.dynamicFeeDepthSaturationBps ?? DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS) / 100,
            ]}
            onValueChange={([v]) =>
              onUpdate({ dynamicFeeDepthSaturationBps: Math.round(v * 100) })
            }
            min={DYNAMIC_FEE_MIN_DEPTH_SATURATION_PCT}
            max={DYNAMIC_FEE_MAX_DEPTH_SATURATION_PCT}
            step={5}
          />
        </PickConfigControl>
        <ConfigHint className="sm:col-span-2">
          Fee scales with how much in-range LP depth your swap consumes — same quote size pays more in a shallow pool · no oracle · ceiling is hard-rejected below base fee
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "buyback-vesting") {
    const days = modules.buybackVestingDurationDays ?? BUYBACK_VESTING_DEFAULT_DAYS;
    const mcapUsd = modules.buybackVestingMcapUsd ?? 0;
    const untilMcap = mcapUsd > 0;
    const mode = modules.buybackVestingUnlockMode === "steps" ? "steps" : "all";
    const stepPct = modules.buybackVestingStepPct ?? [...DEFAULT_MCAP_STEP_PCT];
    return (
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2">
        <McapUnlockPicker
          theme={theme}
          untilMcap={untilMcap}
          mode={mode}
          cliffUsd={untilMcap ? mcapUsd : BUYBACK_VESTING_MCAP_DEFAULT_USD}
          presets={BUYBACK_MCAP_PRESET_USD}
          stepUsd={BUYBACK_STEP_PRESET_USD}
          stepPct={stepPct}
          onUntilMcap={(next) =>
            onUpdate({
              buybackVestingMcapUsd: next ? BUYBACK_VESTING_MCAP_DEFAULT_USD : 0,
              buybackVestingUnlockMode: next ? mode : "all",
            })
          }
          onMode={(next) =>
            onUpdate({
              buybackVestingUnlockMode: next,
              buybackVestingStepPct: next === "steps" ? stepPct : stepPct,
              buybackVestingMcapUsd: mcapUsd > 0 ? mcapUsd : BUYBACK_VESTING_MCAP_DEFAULT_USD,
            })
          }
          onCliff={(usd) => onUpdate({ buybackVestingMcapUsd: usd, buybackVestingUnlockMode: "all" })}
          onStepPct={(pct) => onUpdate({ buybackVestingStepPct: pct, buybackVestingUnlockMode: "steps" })}
        />
        {untilMcap ? null : (
          <PickConfigControl
            theme={theme}
            label="Vest duration"
            value={days >= 365 ? `${(days / 365).toFixed(1)}y` : `${days}d`}
            edit={{
              numericValue: days,
              min: BUYBACK_VESTING_MIN_DAYS,
              max: BUYBACK_VESTING_MAX_DAYS,
              step: 7,
              suffix: "d",
              onCommit: (next) => onUpdate({ buybackVestingDurationDays: next }),
            }}
          >
            <AccentSlider
              accentColor={accent}
              value={[days]}
              onValueChange={([v]) => onUpdate({ buybackVestingDurationDays: v })}
              min={BUYBACK_VESTING_MIN_DAYS}
              max={BUYBACK_VESTING_MAX_DAYS}
              step={7}
            />
          </PickConfigControl>
        )}
        <ConfigHint>
          {untilMcap
            ? mode === "steps"
              ? "Creator fees unlock by % as FDV hits each rung — packed on-chain at launch"
              : "Creator fees unlock in full when FDV hits this target — packed on-chain at launch"
            : "Creator fees unlock linearly over this duration — claim the unlocked slice anytime"}
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "auto-burn") {
    const routeKey: FeeRouteKey = "autoBurnPct";
    return (
      <FeeRouteShareControl
        routeKey={routeKey}
        modules={modules}
        theme={theme}
        accent={accent}
        onUpdate={onUpdate}
      />
    );
  }

  if (hook.id === "deepen-lps") {
    const routeKey: FeeRouteKey = "deepenLpsPct";
    return (
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2">
        <FeeRouteShareControl
          routeKey={routeKey}
          modules={modules}
          theme={theme}
          accent={accent}
          onUpdate={onUpdate}
        />
        <ConfigHint>
          Quote fees mint into the launch LP range — thicker book for whales and traders, not extra LP fee income
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "holder-airdrop") {
    const routeKey: FeeRouteKey = "holderAirdropPct";
    const epochMinutes = Math.round(
      (modules.holderAirdropEpochSeconds ?? HOLDER_AIRDROP_EPOCH_DEFAULT_MINUTES * 60) / 60,
    );
    const mcapUsd = modules.holderAirdropMcapUsd ?? 0;
    const untilMcap = mcapUsd > 0;
    const mode = modules.holderAirdropUnlockMode === "steps" ? "steps" : "all";
    const stepPct = modules.holderAirdropStepPct ?? [...DEFAULT_MCAP_STEP_PCT];
    return (
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2">
        <McapUnlockPicker
          theme={theme}
          untilMcap={untilMcap}
          mode={mode}
          cliffUsd={untilMcap ? mcapUsd : HOLDER_AIRDROP_MCAP_DEFAULT_USD}
          presets={AIRDROP_MCAP_PRESET_USD}
          stepUsd={AIRDROP_STEP_PRESET_USD}
          stepPct={stepPct}
          untilLabel="Until mcap"
          onUntilMcap={(next) =>
            onUpdate({
              holderAirdropMcapUsd: next ? HOLDER_AIRDROP_MCAP_DEFAULT_USD : 0,
              holderAirdropUnlockMode: next ? mode : "all",
            })
          }
          onMode={(next) =>
            onUpdate({
              holderAirdropUnlockMode: next,
              holderAirdropMcapUsd: mcapUsd > 0 ? mcapUsd : HOLDER_AIRDROP_MCAP_DEFAULT_USD,
            })
          }
          onCliff={(usd) => onUpdate({ holderAirdropMcapUsd: usd, holderAirdropUnlockMode: "all" })}
          onStepPct={(pct) => onUpdate({ holderAirdropStepPct: pct, holderAirdropUnlockMode: "steps" })}
        />
        <div className={cn("grid gap-4", untilMcap ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
          <FeeRouteShareControl
            routeKey={routeKey}
            modules={modules}
            theme={theme}
            accent={accent}
            onUpdate={onUpdate}
          />
          {untilMcap ? null : (
            <PickConfigControl
              theme={theme}
              label="Epoch"
              value={`${epochMinutes}m`}
              edit={{
                numericValue: epochMinutes,
                min: HOLDER_AIRDROP_EPOCH_MINUTES,
                max: HOLDER_AIRDROP_EPOCH_MAX_MINUTES,
                step: 1,
                suffix: "m",
                onCommit: (next) => onUpdate({ holderAirdropEpochSeconds: next * 60 }),
              }}
            >
              <AccentSlider
                accentColor={accent}
                value={[epochMinutes]}
                onValueChange={([v]) => onUpdate({ holderAirdropEpochSeconds: v * 60 })}
                min={HOLDER_AIRDROP_EPOCH_MINUTES}
                max={HOLDER_AIRDROP_EPOCH_MAX_MINUTES}
                step={1}
              />
            </PickConfigControl>
          )}
        </div>
        <ConfigHint>
          {untilMcap
            ? mode === "steps"
              ? "Holder drops unlock by % as FDV hits each rung — packed on-chain at launch"
              : "Holder drops unlock in full when FDV hits this target — packed on-chain at launch"
            : "Accrues on swap; next swap after epoch pays all on-chain tracked holders automatically"}
        </ConfigHint>
      </div>
    );
  }

  if (hook.id === "creator-share-to-hook") {
    const hasFeeSink =
      modules.backedFloor ||
      modules.autoBurn ||
      modules.deepenLps ||
      modules.holderAirdrop ||
      hookTaxBps > 0;

    return (
      <ConfigHint>
        {hasFeeSink
          ? "70% creator share → hook pot with your modules"
          : "70% creator share → hook pot (enable floor, burn, LP, or airdrop to route it)"}
      </ConfigHint>
    );
  }

  return null;
}

function FeeRouteShareControl({
  routeKey,
  modules,
  theme,
  accent,
  onUpdate,
}: {
  routeKey: FeeRouteKey;
  modules: LaunchModules;
  theme: HookTheme;
  accent: string;
  onUpdate: (patch: Partial<LaunchModules>) => void;
}) {
  const enabled = listEnabledFeeRoutes(modules);
  const solo = enabled.length === 1;
  const value = modules[routeKey];

  if (solo) {
    return (
      <ConfigHint>100% of hook tax · sole enabled module</ConfigHint>
    );
  }

  return (
    <div>
      <PickConfigControl
        theme={theme}
        label="Share of hook tax"
        value={`${value}%`}
        edit={{
          numericValue: value,
          min: 1,
          max: feeRouteSliderMax(modules, routeKey),
          step: 1,
          suffix: "%",
          onCommit: (next) => onUpdate(setFeeRouteShare(modules, routeKey, next)),
        }}
      >
        <AccentSlider
          accentColor={accent}
          value={[value]}
          onValueChange={([v]) => onUpdate(setFeeRouteShare(modules, routeKey, v))}
          min={1}
          max={feeRouteSliderMax(modules, routeKey)}
          step={1}
        />
      </PickConfigControl>
      <FeeRouteHint modules={modules} />
    </div>
  );
}

function FeeRouteHint({ modules }: { modules: LaunchModules }) {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length <= 1) return null;
  const total = feeRouteTotalPct(modules);

  return (
    <ConfigHint className={cn(total !== 100 && "pick-config-hint--warn")}>
      Enabled modules must share exactly 100% of the hook tax · total {total}%
    </ConfigHint>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookDetailPanel } from "@/components/explore/HookDetailPanel";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { AccentSlider } from "@/components/launch/AccentSlider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hookPickTagline, isModuleEnabled } from "@/lib/launch-module-summary";
import { MAX_HOOK_TAX_BPS } from "@/lib/constants";
import { formatBps } from "@/lib/format";
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
  bpsToSupplyPct,
  formatSupplyCap,
  supplyPctToBps,
} from "@/lib/protocol-limits";
import { BASE_FEE_BPS, DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE, MAX_TOTAL_FEE_BPS } from "@/lib/constants";
import {
  feeRouteSliderMax,
  feeRouteTotalPct,
  listEnabledFeeRoutes,
  rebalanceFeeRoutes,
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

function FixedFeePickCard({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "pick-card pick-card--hook",
        `pick-card--${FIXED_FEE_THEME}`,
        selected && "is-on",
      )}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        <AsciiShape hookId="fixed-fee" theme={FIXED_FEE_THEME} isHovered={hovered || selected} />
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
              <span>Fixed fees</span>
            </h2>
          </div>
        </div>
        <div className="pick-config-ascii" aria-hidden>
          <AsciiShape hookId="fixed-fee" theme={FIXED_FEE_THEME} isHovered />
        </div>
      </div>
      <PickConfigControl theme={FIXED_FEE_THEME} label="Hook fee" value={formatBps(hookTaxBps)}>
        <AccentSlider
          accentColor={accent}
          value={[hookTaxBps]}
          onValueChange={([v]) => onHookTaxBpsChange(v)}
          min={0}
          max={MAX_HOOK_TAX_BPS}
          step={10}
        />
      </PickConfigControl>
      <span
        className={cn(
          "orb-hook-desc-badge pick-config-hint-badge mt-2",
          `orb-hook-desc-badge--${FIXED_FEE_THEME}`,
        )}
      >
        Extra fee for hook modules · leftover → protocol
      </span>
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
  onClick,
}: {
  hook: MasterHook;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn("pick-card pick-card--hook", `pick-card--${hook.theme}`, selected && "is-on")}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <HookPickTooltip hook={hook} />
      <div className="pick-card-mark pick-ascii">
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={hovered || selected} />
      </div>
      <p className="pick-card-title">{hook.title.toLowerCase()}</p>
      <p className="pick-card-sub pick-card-sub--hook">{hookPickTagline(hook.id)}</p>
    </button>
  );
}

function PickConfigControl({
  theme,
  label,
  value,
  children,
}: {
  theme: HookTheme;
  label?: string;
  value: string;
  children: ReactNode;
}) {
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
        <span
          className={cn(
            "pick-config-control-value orb-hook-desc-badge",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          {value}
        </span>
      </div>
      <div className="pick-config-control-track">{children}</div>
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
}) {
  const panelRefs = useRef<Partial<Record<PickerFocusId, HTMLDivElement | null>>>({});
  const visibleHooks = hookIds
    ? MASTER_HOOKS.filter((hook) => hookIds.includes(hook.id))
    : MASTER_HOOKS;
  const enabledHooks = visibleHooks.filter((h) => isModuleEnabled(modules, h.id));
  const fixedFeeEnabled = includeFixedFee && hookTaxBps > 0;
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
    applyHookTax(hookTaxBps > 0 ? hookTaxBps : DEFAULT_FIXED_FEE_BPS);
    scrollToPanel("fixed-fee");
  };

  const renderPickCards = () =>
    visibleHooks.flatMap((hook) => {
      const selected = isModuleEnabled(modules, hook.id);
      const disabled = multiMarket && hook.id === "backed-floor";
      const cards = [
        <HookPickCard
          key={hook.id}
          hook={hook}
          selected={selected}
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

  return (
    <div>
      <p className="pick-heading">{heading}</p>
      <div className="pick-grid pick-grid--hooks">{renderPickCards()}</div>

      {configPanelIds.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-zinc-500">
            All active modules — settings stay visible when you switch focus.
          </p>
          {configPanelIds.map((panelId) => {
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
                />
              </div>
            );
          })}
        </div>
      )}
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
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered />
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
}: {
  hook: MasterHook;
  modules: LaunchModules;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  onHookTaxChange?: (hookTaxBps: number) => void;
  floorEst: number;
  hookTaxBps?: number;
}) {
  const accent = hookAccentColor(hook.id);
  const theme = hook.theme;

  if (NO_CONFIG_HOOKS.has(hook.id)) {
    return null;
  }

  if (hook.id === "anti-snipe") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <PickConfigControl
          theme={theme}
          label="Duration"
          value={`${modules.antiSnipeDuration}s`}
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
        <PickConfigControl
          theme={theme}
          label="Initial tax"
          value={`${modules.antiSnipeInitialTax}%`}
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
        <span
          className={cn(
            "orb-hook-desc-badge pick-config-hint-badge sm:col-span-2",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          Snipe tax and window are fixed at launch (up to {MAX_ANTI_SNIPE_TAX_PCT}% · {MAX_ANTI_SNIPE_DURATION_SEC}s max)
        </span>
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
          <span
            className={cn(
              "orb-hook-desc-badge pick-config-hint-badge mt-2",
              `orb-hook-desc-badge--${theme}`,
            )}
          >
            Est. floor ≈ {floorEst.toFixed(6)} ETH / token
          </span>
        )}
      </div>
    );
  }

  if (hook.id === "max-wallet") {
    return (
      <div>
        <PickConfigControl
          theme={theme}
          label="Cap"
          value={`${formatSupplyCap(modules.maxWalletBps)} of supply`}
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
        <span
          className={cn(
            "orb-hook-desc-badge pick-config-hint-badge mt-2",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply
        </span>
      </div>
    );
  }

  if (hook.id === "max-tx") {
    return (
      <div>
        <PickConfigControl
          theme={theme}
          label="Cap"
          value={`${formatSupplyCap(modules.maxTxBps)} of supply`}
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
        <span
          className={cn(
            "orb-hook-desc-badge pick-config-hint-badge mt-2",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          Fixed at launch · choose between {MIN_SUPPLY_CAP_SLIDER_PCT}% and {MAX_SUPPLY_CAP_SLIDER_PCT}% of supply
        </span>
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
        <div className="sm:col-span-2 grid gap-2">
          <span className="text-xs text-zinc-500">Fee vs activity</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                modules.dynamicFeeRampUp !== false
                  ? "border-violet-500/50 bg-violet-500/10 text-zinc-100"
                  : "border-white/10 bg-black/40 text-zinc-500 hover:border-white/20",
              )}
              onClick={() => onUpdate({ dynamicFeeRampUp: true })}
            >
              <span className="block font-medium">Rise with volume</span>
              <span className="mt-0.5 block text-zinc-500">Low activity → min fee</span>
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                modules.dynamicFeeRampUp === false
                  ? "border-violet-500/50 bg-violet-500/10 text-zinc-100"
                  : "border-white/10 bg-black/40 text-zinc-500 hover:border-white/20",
              )}
              onClick={() => onUpdate({ dynamicFeeRampUp: false })}
            >
              <span className="block font-medium">Fall with volume</span>
              <span className="mt-0.5 block text-zinc-500">High activity → min fee</span>
            </button>
          </div>
        </div>
        <PickConfigControl
          theme={theme}
          label="24h volume to max ramp"
          value={`${modules.dynamicFeeVolumeTargetScale ?? DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE}×`}
        >
          <AccentSlider
            accentColor={accent}
            value={[modules.dynamicFeeVolumeTargetScale ?? DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE]}
            onValueChange={([v]) => onUpdate({ dynamicFeeVolumeTargetScale: Math.round(v) })}
            min={1}
            max={1000}
            step={1}
          />
        </PickConfigControl>
        <span
          className={cn(
            "orb-hook-desc-badge pick-config-hint-badge sm:col-span-2",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          Fees adjust on-chain from 24h quote volume · scale = quote units (×1e18) to saturate the ramp · fixed hook fee slider is disabled
        </span>
      </div>
    );
  }

  if (hook.id === "buyback-vesting") {
    const days = modules.buybackVestingDurationDays ?? 365 * 5;
    return (
      <PickConfigControl
        theme={theme}
        label="Vest duration"
        value={days >= 365 ? `${(days / 365).toFixed(1)}y` : `${days}d`}
      >
        <AccentSlider
          accentColor={accent}
          value={[days]}
          onValueChange={([v]) => onUpdate({ buybackVestingDurationDays: v })}
          min={7}
          max={365 * 5}
          step={7}
        />
      </PickConfigControl>
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

  if (hook.id === "lp-donate") {
    const routeKey: FeeRouteKey = "lpDonatePct";
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

  if (hook.id === "holder-airdrop") {
    const routeKey: FeeRouteKey = "holderAirdropPct";
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

  if (hook.id === "creator-share-to-hook") {
    const hasFeeSink =
      modules.backedFloor ||
      modules.autoBurn ||
      modules.lpDonate ||
      modules.holderAirdrop ||
      hookTaxBps > 0;

    return (
      <span
        className={cn(
          "orb-hook-desc-badge pick-config-hint-badge",
          `orb-hook-desc-badge--${theme}`,
        )}
      >
        {hasFeeSink
          ? "70% creator share → hook pot with your modules"
          : "70% creator share → hook pot (enable floor, burn, LP, or airdrop to route it)"}
        {modules.buybackVesting && " · disabled while buyback vesting is on"}
      </span>
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
      <span
        className={cn(
          "orb-hook-desc-badge pick-config-hint-badge",
          `orb-hook-desc-badge--${theme}`,
        )}
      >
        100% of hook tax · sole enabled module
      </span>
    );
  }

  return (
    <div>
      <PickConfigControl theme={theme} label="Share of hook tax" value={`${value}%`}>
        <AccentSlider
          accentColor={accent}
          value={[value]}
          onValueChange={([v]) => onUpdate(setFeeRouteShare(modules, routeKey, v))}
          min={1}
          max={feeRouteSliderMax(modules, routeKey)}
          step={1}
        />
      </PickConfigControl>
      <FeeRouteHint modules={modules} theme={theme} />
    </div>
  );
}

function FeeRouteHint({ modules, theme }: { modules: LaunchModules; theme: HookTheme }) {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length <= 1) return null;
  const total = feeRouteTotalPct(modules);

  return (
    <span
      className={cn(
        "orb-hook-desc-badge pick-config-hint-badge mt-2 block",
        `orb-hook-desc-badge--${theme}`,
        total !== 100 && "border-amber-500/40 text-amber-100",
      )}
    >
      Enabled modules must share exactly 100% of the hook tax · total {total}%
    </span>
  );
}

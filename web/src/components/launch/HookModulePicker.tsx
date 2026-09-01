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
  hookAccentColor,
  hookThemeAccentColor,
  MASTER_HOOKS,
  type HookTheme,
  type MasterHook,
  type MasterHookId,
} from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_CONFIG_HOOKS = new Set<MasterHookId>(["anti-mev", "dynamic-fees"]);
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
    if (!onHookTaxBpsChange) return;
    if (fixedFeeEnabled) {
      onHookTaxBpsChange(0);
      const next = enabledHooks[0]?.id ?? null;
      setFocus(next);
      return;
    }
    onHookTaxBpsChange(hookTaxBps > 0 ? hookTaxBps : DEFAULT_FIXED_FEE_BPS);
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
                    onHookTaxBpsChange={onHookTaxBpsChange ?? (() => {})}
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
  floorEst,
  hookTaxBps = 0,
}: {
  hook: MasterHook;
  modules: LaunchModules;
  onUpdate: (patch: Partial<LaunchModules>) => void;
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
            min={1}
            max={10}
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
            min={50}
            max={99}
            step={1}
          />
        </PickConfigControl>
      </div>
    );
  }

  if (hook.id === "backed-floor") {
    return (
      <div>
        <PickConfigControl theme={theme} label="Fee to floor" value={`${modules.floorAllocation}%`}>
          <AccentSlider
            accentColor={accent}
            value={[modules.floorAllocation]}
            onValueChange={([v]) => onUpdate({ floorAllocation: v })}
            min={0}
            max={50}
            step={1}
          />
        </PickConfigControl>
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
      <PickConfigControl
        theme={theme}
        value={`${(modules.maxWalletBps / 100).toFixed(1)}% supply`}
      >
        <AccentSlider
          accentColor={accent}
          value={[modules.maxWalletBps / 100]}
          onValueChange={([v]) => onUpdate({ maxWalletBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </PickConfigControl>
    );
  }

  if (hook.id === "max-tx") {
    return (
      <PickConfigControl
        theme={theme}
        value={`${(modules.maxTxBps / 100).toFixed(1)}% supply`}
      >
        <AccentSlider
          accentColor={accent}
          value={[modules.maxTxBps / 100]}
          onValueChange={([v]) => onUpdate({ maxTxBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </PickConfigControl>
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
    return (
      <PickConfigControl theme={theme} label="Burn share" value={`${modules.autoBurnPct}%`}>
        <AccentSlider
          accentColor={accent}
          value={[modules.autoBurnPct]}
          onValueChange={([v]) => onUpdate({ autoBurnPct: v })}
          min={1}
          max={50}
          step={1}
        />
      </PickConfigControl>
    );
  }

  if (hook.id === "lp-donate") {
    return (
      <PickConfigControl theme={theme} label="LP donate share" value={`${modules.lpDonatePct}%`}>
        <AccentSlider
          accentColor={accent}
          value={[modules.lpDonatePct]}
          onValueChange={([v]) => onUpdate({ lpDonatePct: v })}
          min={1}
          max={50}
          step={1}
        />
      </PickConfigControl>
    );
  }

  if (hook.id === "holder-airdrop") {
    return (
      <PickConfigControl
        theme={theme}
        label="Fee to airdrop"
        value={`${modules.holderAirdropPct}%`}
      >
        <AccentSlider
          accentColor={accent}
          value={[modules.holderAirdropPct]}
          onValueChange={([v]) => onUpdate({ holderAirdropPct: v })}
          min={1}
          max={50}
          step={1}
        />
      </PickConfigControl>
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

"use client";

import { useEffect, useRef, useState } from "react";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { AccentSlider } from "@/components/launch/AccentSlider";
import { capitalizeDescription } from "@/lib/format";
import { isModuleEnabled, moduleCardHint } from "@/lib/launch-module-summary";
import {
  hookAccentColor,
  MASTER_HOOKS,
  type MasterHook,
  type MasterHookId,
} from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

function HookPickCard({
  hook,
  selected,
  configHint,
  onClick,
}: {
  hook: MasterHook;
  selected: boolean;
  configHint?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn("pick-card", `pick-card--${hook.theme}`, selected && "is-on")}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="pick-card-mark pick-ascii">
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={hovered || selected} />
      </div>
      <p className="pick-card-title">{hook.title.toLowerCase()}</p>
      <p className="pick-card-sub">
        {selected && configHint
          ? configHint
          : selected
            ? "hooked"
            : capitalizeDescription(hook.description)}
      </p>
    </button>
  );
}

export function HookModulePicker({
  modules,
  onToggle,
  onUpdate,
  floorEst,
  multiMarket = false,
  hookTaxBps = 0,
}: {
  modules: LaunchModules;
  onToggle: (id: MasterHookId, next: boolean) => void;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  floorEst: number;
  multiMarket?: boolean;
  hookTaxBps?: number;
}) {
  const panelRefs = useRef<Partial<Record<MasterHookId, HTMLDivElement | null>>>({});
  const enabledHooks = MASTER_HOOKS.filter((h) => isModuleEnabled(modules, h.id));
  const [focus, setFocus] = useState<MasterHookId | null>(enabledHooks[0]?.id ?? null);

  useEffect(() => {
    if (focus && enabledHooks.some((h) => h.id === focus)) return;
    setFocus(enabledHooks[0]?.id ?? null);
  }, [enabledHooks, focus]);

  useEffect(() => {
    if (enabledHooks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const id = top.target.getAttribute("data-hook-id") as MasterHookId | null;
        if (id) setFocus(id);
      },
      {
        root: null,
        rootMargin: "-28% 0px -38% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      },
    );

    for (const hook of enabledHooks) {
      const el = panelRefs.current[hook.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [enabledHooks]);

  const scrollToPanel = (id: MasterHookId) => {
    setFocus(id);
    requestAnimationFrame(() => {
      panelRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <div>
      <p className="pick-heading">Pick your hooks</p>
      <div className="pick-grid pick-grid--hooks">
        {MASTER_HOOKS.map((hook) => {
          const selected = isModuleEnabled(modules, hook.id);
          const disabled = multiMarket && hook.id === "backed-floor";
          return (
            <HookPickCard
              key={hook.id}
              hook={hook}
              selected={selected}
              configHint={moduleCardHint(hook.id, modules, hookTaxBps)}
              onClick={() => {
                if (disabled) return;
                if (selected) {
                  onToggle(hook.id, false);
                  const next = enabledHooks.find((item) => item.id !== hook.id);
                  setFocus(next?.id ?? null);
                  return;
                }
                onToggle(hook.id, true);
                scrollToPanel(hook.id);
              }}
            />
          );
        })}
      </div>

      {enabledHooks.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-zinc-500">
            All active modules — settings stay visible when you switch focus.
          </p>
          {enabledHooks.map((hook) => (
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
          ))}
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
        <span
          className={cn(
            "orb-hook-desc-badge pick-config-desc-badge",
            `orb-hook-desc-badge--${hook.theme}`,
          )}
        >
          <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
          <span>{capitalizeDescription(hook.description)}</span>
        </span>
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

  if (hook.id === "anti-snipe") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex justify-between text-xs text-zinc-500">
            <span>Duration</span>
            <span className="font-mono text-zinc-300">{modules.antiSnipeDuration}s</span>
          </div>
          <AccentSlider
            accentColor={accent}
            value={[modules.antiSnipeDuration]}
            onValueChange={([v]) => onUpdate({ antiSnipeDuration: v })}
            min={1}
            max={10}
            step={1}
          />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-xs text-zinc-500">
            <span>Initial tax</span>
            <span className="font-mono text-zinc-300">{modules.antiSnipeInitialTax}%</span>
          </div>
          <AccentSlider
            accentColor={accent}
            value={[modules.antiSnipeInitialTax]}
            onValueChange={([v]) => onUpdate({ antiSnipeInitialTax: v })}
            min={50}
            max={99}
            step={1}
          />
        </div>
      </div>
    );
  }

  if (hook.id === "backed-floor") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Fee to floor</span>
          <span className="font-mono text-zinc-300">{modules.floorAllocation}%</span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.floorAllocation]}
          onValueChange={([v]) => onUpdate({ floorAllocation: v })}
          min={0}
          max={50}
          step={1}
        />
        {floorEst > 0 && (
          <p className="mt-2 font-mono text-xs text-emerald-500/80">
            Est. floor ≈ {floorEst.toFixed(6)} ETH / token
          </p>
        )}
      </div>
    );
  }

  if (hook.id === "max-wallet") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Cap</span>
          <span className="font-mono text-zinc-300">
            {(modules.maxWalletBps / 100).toFixed(1)}% supply
          </span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.maxWalletBps / 100]}
          onValueChange={([v]) => onUpdate({ maxWalletBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </div>
    );
  }

  if (hook.id === "max-tx") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Cap</span>
          <span className="font-mono text-zinc-300">{(modules.maxTxBps / 100).toFixed(1)}% supply</span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.maxTxBps / 100]}
          onValueChange={([v]) => onUpdate({ maxTxBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </div>
    );
  }

  if (hook.id === "buyback-vesting") {
    const days = modules.buybackVestingDurationDays ?? 365 * 5;
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Vest duration</span>
          <span className="font-mono text-zinc-300">
            {days >= 365 ? `${(days / 365).toFixed(1)}y` : `${days}d`}
          </span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[days]}
          onValueChange={([v]) => onUpdate({ buybackVestingDurationDays: v })}
          min={7}
          max={365 * 5}
          step={7}
        />
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          Creator fee share (70% of base) vests linearly · claim on the token page
        </p>
      </div>
    );
  }

  if (hook.id === "auto-burn") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Burn share</span>
          <span className="font-mono text-zinc-300">{modules.autoBurnPct}%</span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.autoBurnPct]}
          onValueChange={([v]) => onUpdate({ autoBurnPct: v })}
          min={1}
          max={50}
          step={1}
        />
      </div>
    );
  }

  if (hook.id === "lp-donate") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>LP donate share</span>
          <span className="font-mono text-zinc-300">{modules.lpDonatePct}%</span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.lpDonatePct]}
          onValueChange={([v]) => onUpdate({ lpDonatePct: v })}
          min={1}
          max={50}
          step={1}
        />
      </div>
    );
  }

  if (hook.id === "holder-airdrop") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Fee to holder airdrop</span>
          <span className="font-mono text-zinc-300">{modules.holderAirdropPct}%</span>
        </div>
        <AccentSlider
          accentColor={accent}
          value={[modules.holderAirdropPct]}
          onValueChange={([v]) => onUpdate({ holderAirdropPct: v })}
          min={1}
          max={50}
          step={1}
        />
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          Accrues in quote · permissionless push every 15 minutes · pro-rata by balance
        </p>
      </div>
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
      <div className="space-y-2 text-xs leading-relaxed text-zinc-500">
        {hasFeeSink ? (
          <p>
            Your 70% base share joins the same hook pot as the hook tax, split across enabled
            modules.
          </p>
        ) : (
          <p>
            No fee modules selected — your 70% base share still routes to the hook pot and
            unallocated amounts go to the protocol treasury. Enable floor, burn, donate, or airdrop
            to direct it.
          </p>
        )}
        {modules.buybackVesting && (
          <p className="text-amber-600/90">
            Disabled while buyback vesting is on — they cannot run together.
          </p>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-1 font-mono text-[11px] text-zinc-500">
      {MASTER_HOOKS.find((item) => item.id === hook.id)?.settings.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
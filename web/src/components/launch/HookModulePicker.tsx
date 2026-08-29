"use client";

import { useEffect, useRef, useState } from "react";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { Slider } from "@/components/ui/slider";
import { capitalizeDescription } from "@/lib/format";
import { isModuleEnabled, moduleCardHint } from "@/lib/launch-module-summary";
import {
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
}: {
  modules: LaunchModules;
  onToggle: (id: MasterHookId, next: boolean) => void;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  floorEst: number;
  multiMarket?: boolean;
}) {
  const panelRefs = useRef<Partial<Record<MasterHookId, HTMLDivElement | null>>>({});
  const enabledHooks = MASTER_HOOKS.filter(
    (h) => h.id !== "creator-share-to-hook" && isModuleEnabled(modules, h.id),
  );
  const selectedCount = enabledHooks.length;
  const [focus, setFocus] = useState<MasterHookId | null>(enabledHooks[0]?.id ?? null);

  useEffect(() => {
    if (focus && enabledHooks.some((h) => h.id === focus)) return;
    setFocus(enabledHooks[0]?.id ?? null);
  }, [enabledHooks, focus]);

  const scrollToPanel = (id: MasterHookId) => {
    setFocus(id);
    requestAnimationFrame(() => {
      panelRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <div>
      <p className="pick-kicker">
        —hooks: {selectedCount} live · {MASTER_HOOKS.length - 1} modules available
      </p>
      <p className="pick-heading">pick your hooks</p>
      <div className="pick-grid pick-grid--hooks">
        {MASTER_HOOKS.filter((hook) => hook.id !== "creator-share-to-hook").map((hook) => {
          const selected = isModuleEnabled(modules, hook.id);
          const disabled = multiMarket && hook.id === "backed-floor";
          return (
            <HookPickCard
              key={hook.id}
              hook={hook}
              selected={selected}
              configHint={moduleCardHint(hook.id, modules)}
              onClick={() => {
                if (disabled) return;
                if (selected && focus === hook.id) {
                  onToggle(hook.id, false);
                  const next = enabledHooks.find((item) => item.id !== hook.id);
                  setFocus(next?.id ?? null);
                  return;
                }
                if (!selected) onToggle(hook.id, true);
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
              ref={(el) => {
                panelRefs.current[hook.id] = el;
              }}
              className={cn(
                "pick-config pick-config--panel transition-shadow",
                `pick-config--${hook.theme}`,
                focus === hook.id && "pick-config--focused",
              )}
              onClick={() => setFocus(hook.id)}
            >
              <HookConfigHeader hook={hook} active={focus === hook.id} />
              <HookSettings
                hookId={hook.id}
                modules={modules}
                onUpdate={onUpdate}
                floorEst={floorEst}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HookConfigHeader({ hook, active }: { hook: MasterHook; active: boolean }) {
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
          <HookSettingsTooltip hook={hook} />
        </div>
        <p className="pick-config-copy">{capitalizeDescription(hook.description)}</p>
      </div>
      <div className="pick-config-ascii" aria-hidden>
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered />
      </div>
    </div>
  );
}

function HookSettings({
  hookId,
  modules,
  onUpdate,
  floorEst,
}: {
  hookId: MasterHookId;
  modules: LaunchModules;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  floorEst: number;
}) {
  if (hookId === "anti-snipe") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex justify-between text-xs text-zinc-500">
            <span>Duration</span>
            <span className="font-mono text-zinc-300">{modules.antiSnipeDuration}s</span>
          </div>
          <Slider
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
          <Slider
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

  if (hookId === "backed-floor") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Fee to floor</span>
          <span className="font-mono text-zinc-300">{modules.floorAllocation}%</span>
        </div>
        <Slider
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

  if (hookId === "max-wallet") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Cap</span>
          <span className="font-mono text-zinc-300">
            {(modules.maxWalletBps / 100).toFixed(1)}% supply
          </span>
        </div>
        <Slider
          value={[modules.maxWalletBps / 100]}
          onValueChange={([v]) => onUpdate({ maxWalletBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </div>
    );
  }

  if (hookId === "max-tx") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Cap</span>
          <span className="font-mono text-zinc-300">{(modules.maxTxBps / 100).toFixed(1)}% supply</span>
        </div>
        <Slider
          value={[modules.maxTxBps / 100]}
          onValueChange={([v]) => onUpdate({ maxTxBps: Math.round(v * 100) })}
          min={0.5}
          max={5}
          step={0.1}
        />
      </div>
    );
  }

  if (hookId === "buyback-vesting") {
    const days = modules.buybackVestingDurationDays ?? 365 * 5;
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Vest duration</span>
          <span className="font-mono text-zinc-300">
            {days >= 365 ? `${(days / 365).toFixed(1)}y` : `${days}d`}
          </span>
        </div>
        <Slider
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

  if (hookId === "auto-burn") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Burn share</span>
          <span className="font-mono text-zinc-300">{modules.autoBurnPct}%</span>
        </div>
        <Slider
          value={[modules.autoBurnPct]}
          onValueChange={([v]) => onUpdate({ autoBurnPct: v })}
          min={1}
          max={50}
          step={1}
        />
      </div>
    );
  }

  if (hookId === "lp-donate") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>LP donate share</span>
          <span className="font-mono text-zinc-300">{modules.lpDonatePct}%</span>
        </div>
        <Slider
          value={[modules.lpDonatePct]}
          onValueChange={([v]) => onUpdate({ lpDonatePct: v })}
          min={1}
          max={50}
          step={1}
        />
      </div>
    );
  }

  if (hookId === "holder-airdrop") {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>Fee to holder airdrop</span>
          <span className="font-mono text-zinc-300">{modules.holderAirdropPct}%</span>
        </div>
        <Slider
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

  return (
    <ul className="space-y-1 font-mono text-[11px] text-zinc-500">
      {MASTER_HOOKS.find((hook) => hook.id === hookId)?.settings.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
"use client";

import { useState } from "react";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { Slider } from "@/components/ui/slider";
import {
  HOOK_MODULE_FIELD,
  MASTER_HOOKS,
  type MasterHook,
  type MasterHookId,
} from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

function hookOn(modules: LaunchModules, id: MasterHookId) {
  return Boolean(modules[HOOK_MODULE_FIELD[id]]);
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
      className={cn("pick-card", selected && "is-on")}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="pick-card-mark pick-ascii">
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={hovered || selected} />
      </div>
      <p className="pick-card-title">{hook.title.toLowerCase()}</p>
      <p className="pick-card-sub">{selected ? "hooked" : hook.description}</p>
    </button>
  );
}

export function HookModulePicker({
  modules,
  onToggle,
  onUpdate,
  floorEst,
}: {
  modules: LaunchModules;
  onToggle: (id: MasterHookId, next: boolean) => void;
  onUpdate: (patch: Partial<LaunchModules>) => void;
  floorEst: number;
}) {
  const selectedCount = MASTER_HOOKS.filter((hook) => hookOn(modules, hook.id)).length;
  const [focus, setFocus] = useState<MasterHookId | null>(
    MASTER_HOOKS.find((hook) => hookOn(modules, hook.id))?.id ?? null,
  );
  const focused = MASTER_HOOKS.find((hook) => hook.id === focus) ?? null;
  const focusedOn = focused ? hookOn(modules, focused.id) : false;

  return (
    <div>
      <p className="pick-kicker">
        —hooks: {selectedCount} live · {MASTER_HOOKS.length} modules available
      </p>
      <p className="pick-heading">pick your hooks</p>
      <div className="pick-grid pick-grid--hooks">
        {MASTER_HOOKS.map((hook) => {
          const selected = hookOn(modules, hook.id);
          return (
            <HookPickCard
              key={hook.id}
              hook={hook}
              selected={selected}
              onClick={() => {
                if (selected && focus === hook.id) {
                  onToggle(hook.id, false);
                  const next = MASTER_HOOKS.find(
                    (item) => item.id !== hook.id && hookOn(modules, item.id),
                  );
                  setFocus(next?.id ?? null);
                  return;
                }
                if (!selected) onToggle(hook.id, true);
                setFocus(hook.id);
              }}
            />
          );
        })}
      </div>

      {focused && focusedOn && (
        <div className="pick-config">
          <p className="pick-config-title">{focused.title}</p>
          <p className="pick-config-copy">{focused.description}</p>
          <HookSettings hookId={focused.id} modules={modules} onUpdate={onUpdate} floorEst={floorEst} />
        </div>
      )}
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
          <span className="font-mono text-zinc-300">
            {(modules.maxTxBps / 100).toFixed(1)}% supply
          </span>
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

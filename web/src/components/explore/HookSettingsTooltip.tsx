"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { HookDetailPanel } from "@/components/explore/HookDetailPanel";
import { getHookPresetDetails } from "@/lib/hook-presets";
import { moduleDetailLine } from "@/lib/launch-module-summary";
import type { BrowseHook, MasterHook } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

type HookSettingsTooltipProps = {
  hook: BrowseHook | MasterHook;
  modules?: LaunchModules;
  hookTaxBps?: number;
  className?: string;
};

export function HookSettingsTooltip({
  hook,
  modules,
  hookTaxBps = 0,
  className,
}: HookSettingsTooltipProps) {
  const [open, setOpen] = useState(false);
  const preset = getHookPresetDetails(hook);
  const launchConfig =
    modules && hook.id !== "fixed-fee"
      ? moduleDetailLine(hook.id, modules, hookTaxBps)
      : null;

  return (
    <div
      className="hook-settings-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${hook.title} rules and settings`}
        aria-expanded={open}
        className={cn("hook-settings-trigger", className)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          className="hook-settings-tooltip hook-settings-float"
          role="tooltip"
          onClick={(event) => event.stopPropagation()}
        >
          <HookDetailPanel
            hook={hook}
            launchConfig={launchConfig}
            presetSummary={modules ? null : preset.summary}
          />
        </div>
      ) : null}
    </div>
  );
}

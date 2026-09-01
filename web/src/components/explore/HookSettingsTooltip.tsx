"use client";

import { Info } from "lucide-react";

import { HookDetailPanel } from "@/components/explore/HookDetailPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getHookPresetDetails } from "@/lib/hook-presets";
import { hookPickDetail, moduleDetailLine } from "@/lib/launch-module-summary";
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
  const preset = getHookPresetDetails(hook);
  const launchConfig =
    modules && hook.id !== "fixed-fee"
      ? moduleDetailLine(hook.id, modules, hookTaxBps)
      : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${hook.title} rules and settings`}
          className={cn("hook-settings-trigger", className)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={10}
        className="hook-settings-tooltip border-0 bg-transparent p-0 shadow-none"
      >
        {modules ? (
          <HookDetailPanel hook={hook} launchConfig={launchConfig} />
        ) : (
          <BrowseHookPanel hook={hook} presetSummary={preset.summary} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function BrowseHookPanel({
  hook,
  presetSummary,
}: {
  hook: BrowseHook | MasterHook;
  presetSummary: string;
}) {
  return (
    <div className="hook-settings-panel">
      <p className="hook-settings-panel-title">{hook.title}</p>
      <p className="hook-settings-panel-body">{hookPickDetail(hook.id)}</p>
      <p className="hook-settings-panel-meta">{presetSummary}</p>
    </div>
  );
}

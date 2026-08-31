"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getHookPresetDetails, type HookPresetDetails } from "@/lib/hook-presets";
import { moduleDetailLine } from "@/lib/launch-module-summary";
import type { MasterHook } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

type HookSettingsTooltipProps = {
  hook: MasterHook;
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
  const tokenConfig = modules ? moduleDetailLine(hook.id, modules, hookTaxBps) : null;

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
        {tokenConfig ? (
          <TokenConfigPanel hook={hook} config={tokenConfig} />
        ) : (
          <HookSettingsPanel preset={preset} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function TokenConfigPanel({ hook, config }: { hook: MasterHook; config: string }) {
  return (
    <div className="hook-settings-panel">
      <p className="hook-settings-panel-title">{hook.title}</p>
      <p className="hook-settings-panel-meta font-medium text-foreground">{config}</p>
      <p className="hook-settings-panel-meta">{hook.description}</p>
    </div>
  );
}

function HookSettingsPanel({ preset }: { preset: HookPresetDetails }) {
  return (
    <div className="hook-settings-panel">
      <p className="hook-settings-panel-title">{preset.title}</p>
      <ul className="hook-settings-panel-list">
        {preset.lines.map((line) => (
          <li key={line}>+ {line}</li>
        ))}
      </ul>
      <p className="hook-settings-panel-meta">{preset.summary}</p>
      {preset.savedAt !== "Block —" && (
        <p className="hook-settings-panel-meta">{preset.savedAt}</p>
      )}
    </div>
  );
}

"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getHookPresetDetails, type HookPresetDetails } from "@/lib/hook-presets";
import type { MasterHook } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

type HookSettingsTooltipProps = {
  hook: MasterHook;
  className?: string;
};

export function HookSettingsTooltip({ hook, className }: HookSettingsTooltipProps) {
  const preset = getHookPresetDetails(hook);

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
        <HookSettingsPanel preset={preset} />
      </TooltipContent>
    </Tooltip>
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

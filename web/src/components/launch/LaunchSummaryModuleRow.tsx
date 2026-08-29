"use client";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookChip } from "@/components/hooks/HookMark";
import {
  HOOK_MARKS,
  HOOK_MARK_THEME,
  HOOK_MARK_TO_MASTER,
  type HookId,
} from "@/lib/hook-marks";
import { hookMarkSummaryDetail } from "@/lib/launch-module-summary";
import { MASTER_HOOKS, type HookTheme } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

function resolveHookTheme(id: HookId): HookTheme {
  const masterId = HOOK_MARK_TO_MASTER[id];
  const master = masterId ? MASTER_HOOKS.find((hook) => hook.id === masterId) : null;
  return HOOK_MARK_THEME[id] ?? master?.theme ?? "void";
}

function HookAsciiMark({ id, theme }: { id: HookId; theme: HookTheme }) {
  const def = HOOK_MARKS[id];
  const masterId = HOOK_MARK_TO_MASTER[id];

  if (!masterId) return null;

  return (
    <span
      className="hook-ascii-mark inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md"
      style={{ background: def.color, boxShadow: `0 0 12px ${def.glow}` }}
      aria-hidden
    >
      <AsciiShape hookId={masterId} theme={theme} isHovered />
    </span>
  );
}

export function LaunchSummaryModuleRow({
  id,
  modules,
}: {
  id: HookId;
  modules: LaunchModules;
}) {
  const def = HOOK_MARKS[id];
  const theme = resolveHookTheme(id);
  const detail = hookMarkSummaryDetail(id, modules);
  const masterId = HOOK_MARK_TO_MASTER[id];

  if (!masterId) {
    return (
      <li className="flex items-center justify-between gap-2">
        <HookChip id={id} className="shrink-0" />
        <span
          className={cn(
            "launch-summary-detail-badge orb-hook-desc-badge",
            `orb-hook-desc-badge--${theme}`,
          )}
        >
          {detail}
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-1.5 py-0.5 pr-2 text-[10px] font-medium"
        style={{
          borderColor: `${def.color}40`,
          background: `${def.color}14`,
          color: def.color,
        }}
      >
        <HookAsciiMark id={id} theme={theme} />
        {def.short}
      </span>
      <span
        className={cn(
          "launch-summary-detail-badge orb-hook-desc-badge",
          `orb-hook-desc-badge--${theme}`,
        )}
      >
        {detail}
      </span>
    </li>
  );
}

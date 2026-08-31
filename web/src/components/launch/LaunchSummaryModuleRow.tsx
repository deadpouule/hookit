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
  const masterId = HOOK_MARK_TO_MASTER[id];

  if (!masterId) return null;

  return (
    <span
      className="hook-ascii-mark inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden"
      aria-hidden
    >
      <AsciiShape hookId={masterId} theme={theme} isHovered />
    </span>
  );
}

export function LaunchSummaryModuleRow({
  id,
  modules,
  hookTaxBps = 0,
}: {
  id: HookId;
  modules: LaunchModules;
  hookTaxBps?: number;
}) {
  const def = HOOK_MARKS[id];
  const theme = resolveHookTheme(id);
  const detail = hookMarkSummaryDetail(id, modules, hookTaxBps);
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
        className={cn(
          "launch-summary-hook-chip orb-hook-desc-badge",
          `orb-hook-desc-badge--${theme}`,
        )}
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

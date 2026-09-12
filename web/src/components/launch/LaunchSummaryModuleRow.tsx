"use client";

import { HookLogo } from "@/components/home/market/HookLogo";
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
      <HookLogo hookId={masterId} theme={theme} />
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
        <span className="launch-summary-detail">{detail}</span>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="launch-summary-hook-chip">
        <HookAsciiMark id={id} theme={theme} />
        {def.short}
      </span>
      <span className="launch-summary-detail">{detail}</span>
    </li>
  );
}

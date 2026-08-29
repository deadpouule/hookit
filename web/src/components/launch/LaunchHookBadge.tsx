"use client";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookChip } from "@/components/hooks/HookMark";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import {
  HOOK_MARKS,
  HOOK_MARK_THEME,
  HOOK_MARK_TO_MASTER,
  type HookId,
} from "@/lib/hook-marks";
import { MASTER_HOOKS, type HookTheme, type MasterHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

function resolveHookBadge(id: HookId): {
  masterId: MasterHookId;
  theme: HookTheme;
  title: string;
} | null {
  const masterId = HOOK_MARK_TO_MASTER[id];
  if (!masterId) return null;

  const masterHook = MASTER_HOOKS.find((hook) => hook.id === masterId);
  if (!masterHook) return null;

  const mark = HOOK_MARKS[id];
  const title = id === "quoteFee" || id === "custom" ? mark.label : masterHook.title;
  const theme = HOOK_MARK_THEME[id] ?? masterHook.theme;

  return { masterId, theme, title };
}

export function LaunchHookBadge({ id }: { id: HookId }) {
  const badge = resolveHookBadge(id);
  if (!badge) return <HookChip id={id} />;

  return (
    <div className={cn("launch-hook-badge", `launch-hook-badge--${badge.theme}`)}>
      <div className="launch-hook-badge-ascii" aria-hidden>
        <AsciiShape hookId={badge.masterId} theme={badge.theme} isHovered />
      </div>
      <span
        className={cn(
          "orb-hook-desc-badge orb-hook-title-badge launch-hook-badge-name",
          `orb-hook-desc-badge--${badge.theme}`,
        )}
      >
        <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
        <span>{badge.title}</span>
      </span>
    </div>
  );
}

"use client";

import { BACKED_FLOOR_VOLUME_EXAMPLE, hookPickDetail } from "@/lib/launch-module-summary";
import type { BrowseHook, MasterHook } from "@/lib/master-hooks";

export function HookDetailPanel({
  hook,
  launchConfig,
  presetSummary,
}: {
  hook: MasterHook | BrowseHook;
  launchConfig?: string | null;
  presetSummary?: string | null;
}) {
  return (
    <div className="hook-settings-panel">
      <p className="hook-settings-panel-title">{hook.title}</p>
      <p className="hook-settings-panel-body">{hookPickDetail(hook.id)}</p>
      {hook.id === "backed-floor" ? <BackedFloorVolumeExample /> : null}
      {launchConfig ? (
        <p className="hook-settings-panel-meta hook-settings-panel-meta--launch">
          This launch · {launchConfig}
        </p>
      ) : presetSummary ? (
        <p className="hook-settings-panel-meta">{presetSummary}</p>
      ) : null}
    </div>
  );
}

function BackedFloorVolumeExample() {
  return (
    <div className="hook-settings-example">
      <p>{BACKED_FLOOR_VOLUME_EXAMPLE.intro}</p>
      {BACKED_FLOOR_VOLUME_EXAMPLE.groups.map((group) => (
        <div key={group.taxPct}>
          <p className="hook-settings-example-kicker">At {group.taxPct}% tax</p>
          <ul>
            {group.rows.map((row) => (
              <li key={row.volume}>
                <span>{row.volume} volume</span>
                <span>floor {row.floor}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

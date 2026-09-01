"use client";

import { hookPickDetail } from "@/lib/launch-module-summary";
import type { MasterHook } from "@/lib/master-hooks";

export function HookDetailPanel({
  hook,
  launchConfig,
}: {
  hook: MasterHook;
  launchConfig?: string | null;
}) {
  return (
    <div className="hook-settings-panel">
      <p className="hook-settings-panel-title">{hook.title}</p>
      <p className="hook-settings-panel-body">{hookPickDetail(hook.id)}</p>
      {launchConfig ? (
        <p className="hook-settings-panel-meta hook-settings-panel-meta--launch">
          This launch · {launchConfig}
        </p>
      ) : null}
    </div>
  );
}

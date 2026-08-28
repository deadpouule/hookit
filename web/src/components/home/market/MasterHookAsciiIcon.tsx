"use client";

import { useState } from "react";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

export function MasterHookAsciiIcon({
  hookId,
  className,
}: {
  hookId: MasterHookId;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hook = MASTER_HOOKS.find((item) => item.id === hookId);
  if (!hook) return null;

  return (
    <span
      className={cn("master-hook-ascii-icon", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AsciiShape hookId={hookId} theme={hook.theme} isHovered={hovered} />
    </span>
  );
}

"use client";

import type { ReactNode } from "react";

import type { HookModuleAccent } from "@/lib/hook-modules";
import { cn } from "@/lib/utils";

type Props = {
  accent: HookModuleAccent;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: ReactNode;
};

export function HookModuleCard({
  accent,
  label,
  description,
  enabled,
  onToggle,
  children,
}: Props) {
  const Icon = accent.icon;

  return (
    <div
      className={cn(
        "gel-surface transition-all duration-300",
        enabled && "gel-surface-active",
        !enabled && "opacity-80",
      )}
      style={
        enabled
          ? {
              boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.11), inset 3px 0 0 0 ${accent.color}, 0 0 48px -10px ${accent.glow}`,
            }
          : undefined
      }
    >
      <div className="relative z-[1] flex items-start justify-between gap-4 p-4">
        <div className="flex gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center border",
              enabled ? cn(accent.bg, accent.border, "gel-chip") : "gel-inset border-white/[0.06]",
            )}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: enabled ? accent.color : "#52525b" }}
            />
          </div>
          <div>
            <p className={cn("text-sm font-medium", enabled ? "text-zinc-100" : "text-zinc-500")}>
              {label}
            </p>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{description}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className="gel-toggle-track"
          style={enabled ? { boxShadow: `inset 0 2px 6px rgb(0 0 0 / 0.45), 0 0 14px ${accent.glow}` } : undefined}
        >
          <span
            className={cn(
              "gel-toggle-thumb",
              enabled ? "gel-toggle-thumb-on" : "bg-zinc-600",
            )}
            style={enabled ? { backgroundColor: accent.color } : undefined}
          />
        </button>
      </div>

      {enabled && children && (
        <div className="relative z-[1] border-t border-white/[0.04] px-4 pt-3 pb-4">{children}</div>
      )}
    </div>
  );
}

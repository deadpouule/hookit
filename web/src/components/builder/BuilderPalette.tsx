"use client";

import { LIVE_BLOCKS, SOON_BLOCKS, isBlockEnabled, type LiveBlockId } from "@/lib/hook-builder";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  modules: LaunchModules;
  hookTaxBps: number;
  selected: LiveBlockId | null;
  onToggle: (id: LiveBlockId) => void;
  onSelectSoon: (label: string, description: string) => void;
};

export function BuilderPalette({
  modules,
  hookTaxBps,
  selected,
  onToggle,
  onSelectSoon,
}: Props) {
  return (
    <div>
      <p className="text-xs text-zinc-500">Hook rules · click to add</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {LIVE_BLOCKS.map((block) => {
          const enabled = isBlockEnabled(block.id as LiveBlockId, modules, hookTaxBps);
          const Icon = block.accent.icon;
          const isSelected = selected === block.id;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onToggle(block.id as LiveBlockId)}
              aria-pressed={enabled}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
                enabled ? "bg-black/30" : "border-white/[0.06] bg-black/15 hover:border-white/12",
              )}
              style={
                enabled
                  ? {
                      borderColor: `${block.accent.color}66`,
                      ...(isSelected
                        ? { boxShadow: `0 0 24px -12px ${block.accent.glow}` }
                        : {}),
                    }
                  : undefined
              }
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                  enabled ? "border-white/10" : "border-white/[0.06]",
                )}
                style={enabled ? { background: `${block.accent.color}18` } : undefined}
                suppressHydrationWarning
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: enabled ? block.accent.color : "#52525b" }}
                />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className={cn("text-sm", enabled ? "text-zinc-100" : "text-zinc-400")}>
                    {block.label}
                  </span>
                  {enabled ? (
                    <span className="font-mono text-[10px] text-zinc-500">on</span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-600">
                  {block.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-500">Coming soon · not composable yet</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {SOON_BLOCKS.map((block) => {
          const Icon = block.icon ?? block.accent.icon;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectSoon(block.label, block.description)}
              className="flex items-start gap-3 rounded-xl border border-dashed border-white/[0.08] bg-black/10 px-3 py-3 text-left opacity-70 transition hover:opacity-100"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06]">
                <Icon className="h-3.5 w-3.5 text-zinc-600" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">{block.label}</span>
                  <span className="rounded-full border border-white/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                    Soon
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-600">
                  {block.short}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

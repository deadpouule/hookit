"use client";

import { CustomsGlyph, MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import type { HookMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  mode: HookMode;
  onChange: (mode: HookMode) => void;
};

export function HookArchitectureSection({ mode, onChange }: Props) {
  return (
    <div className="launch-hook-arch">
      <p className="pick-heading">Hook architecture</p>

      <div className="mb-4">
        <div className="launch-mode-toggle" role="tablist" aria-label="Hook architecture">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "master"}
            onClick={() => onChange("master")}
            className={cn(
              "launch-mode-toggle__btn launch-mode-toggle__btn--master",
              mode === "master" && "is-active",
            )}
          >
            <MasterHookGlyph className="launch-mode-toggle__glyph" />
            Master Hook
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            onClick={() => onChange("custom")}
            className={cn(
              "launch-mode-toggle__btn launch-mode-toggle__btn--custom",
              mode === "custom" && "is-active",
            )}
          >
            <CustomsGlyph className="launch-mode-toggle__glyph launch-mode-toggle__glyph--code" />
            Custom Solidity
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {mode === "custom"
            ? "Deploy your own Uniswap v4 hook bytecode at launch."
            : "Pre-built Hookit modules — anti-snipe, backed floor, anti-MEV, and quote-only fees. Configure below."}
        </p>
      </div>
    </div>
  );
}

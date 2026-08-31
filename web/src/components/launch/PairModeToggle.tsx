"use client";

import { MultiPairGlyph, SinglePairGlyph } from "@/components/home/market/CategoryGlyphs";
import { cn } from "@/lib/utils";

type PairMode = "single" | "multi";

type Props = {
  value: PairMode;
  onChange: (mode: PairMode) => void;
};

export function PairModeToggle({ value, onChange }: Props) {
  return (
    <div className="launch-mode-toggle" role="tablist" aria-label="Pairing mode">
      <button
        type="button"
        role="tab"
        aria-selected={value === "single"}
        onClick={() => onChange("single")}
        className={cn(
          "launch-mode-toggle__btn launch-mode-toggle__btn--single",
          value === "single" && "is-active",
        )}
      >
        <SinglePairGlyph className="launch-mode-toggle__glyph" />
        Single pair
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "multi"}
        onClick={() => onChange("multi")}
        className={cn(
          "launch-mode-toggle__btn launch-mode-toggle__btn--multi",
          value === "multi" && "is-active",
        )}
      >
        <MultiPairGlyph className="launch-mode-toggle__glyph launch-mode-toggle__glyph--layers" />
        Multi-pair (2–5)
      </button>
    </div>
  );
}

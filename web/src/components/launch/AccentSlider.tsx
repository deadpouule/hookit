"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Slider> & {
  accentColor: string;
};

export function AccentSlider({ accentColor, className, ...props }: Props) {
  return (
    <div
      className={cn(
        "accent-slider [&_[data-slot=slider-range]]:transition-colors [&_[data-slot=slider-thumb]]:transition-[border-color,box-shadow]",
        className,
      )}
      style={
        {
          "--slider-accent": accentColor,
        } as React.CSSProperties
      }
    >
      <Slider
        {...props}
        className="[&_[data-slot=slider-range]]:bg-[var(--slider-accent)] [&_[data-slot=slider-thumb]]:border-[color:var(--slider-accent)] [&_[data-slot=slider-thumb]]:shadow-[0_0_10px_color-mix(in_srgb,var(--slider-accent)_45%,transparent)]"
      />
    </div>
  );
}

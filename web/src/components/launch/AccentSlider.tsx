"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Slider> & {
  accentColor: string;
};

export function AccentSlider({ accentColor, className, ...props }: Props) {
  return (
    <div
      className={cn("[&_[data-slot=slider-range]]:transition-colors", className)}
      style={
        {
          "--slider-accent": accentColor,
        } as React.CSSProperties
      }
    >
      <Slider
        {...props}
        className="[&_[data-slot=slider-range]]:bg-[var(--slider-accent)]"
      />
    </div>
  );
}

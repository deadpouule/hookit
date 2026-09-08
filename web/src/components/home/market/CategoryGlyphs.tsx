import { Code2, Layers } from "lucide-react";

import { cn } from "@/lib/utils";

export function MasterHookGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("category-hook-glyph", className)} aria-hidden>
      <span>╱▔▔╲</span>
      <span>│▣│</span>
      <span>╲__╱</span>
    </span>
  );
}

export function SinglePairGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("category-single-pair-glyph", className)} aria-hidden>
      <span>╭─●─╮</span>
      <span>╰───╯</span>
    </span>
  );
}

export function CustomsGlyph({ className }: { className?: string }) {
  return <Code2 className={cn("category-customs-icon", className)} aria-hidden />;
}

export function RwaGlyph({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/quotrons-mark.png"
      alt=""
      width={18}
      height={18}
      className={cn("category-quotrons-logo", className)}
      draggable={false}
    />
  );
}

export function MultiPairGlyph({ className }: { className?: string }) {
  return <Layers className={cn("category-multi-pair-icon", className)} aria-hidden />;
}

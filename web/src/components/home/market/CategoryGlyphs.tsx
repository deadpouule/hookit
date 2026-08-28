import { Code2, Landmark } from "lucide-react";

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

export function CustomsGlyph({ className }: { className?: string }) {
  return <Code2 className={cn("category-customs-icon", className)} aria-hidden />;
}

export function RwaGlyph({ className }: { className?: string }) {
  return <Landmark className={cn("category-rwa-icon", className)} aria-hidden />;
}

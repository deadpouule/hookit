import { Code2, Layers } from "lucide-react";

import { cn } from "@/lib/utils";

export function MasterHookGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("category-hook-glyph category-chef-hat", className)}
      aria-hidden
    >
      <rect
        x="14"
        y="40"
        width="36"
        height="16"
        rx="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <path
        d="M20 40c-7.2 0-10.4-10.5-3.8-14.2C14.8 16.4 24 12 32 19.2 40 12 49.2 16.4 47.8 25.8 54.4 29.5 51.2 40 44 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 16.2v10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
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

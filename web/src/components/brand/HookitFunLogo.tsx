import { cn } from "@/lib/utils";

function InfinityGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 14" className={className} fill="none" aria-hidden>
      <path
        d="M7 7c0-3.1 2.4-5.5 5.5-5.5S18 3.9 18 7s-2.4 5.5-5.5 5.5S7 10.1 7 7Zm14 0c0-3.1-2.4-5.5-5.5-5.5S10 3.9 10 7s2.4 5.5 5.5 5.5S21 10.1 21 7Z"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <span className={cn("hookit-fun-logo", className)} aria-hidden>
      <span>H</span>
      <InfinityGlyph className="hookit-fun-logo__infinity" />
      <span>kit.fun</span>
    </span>
  );
}

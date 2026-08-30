import { cn } from "@/lib/utils";

function InfinityGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" className={className} fill="none" aria-hidden>
      <path
        d="M24 12C24 5.5 18 2.5 12 5.8C6 9.1 6 14.9 12 18.2C18 21.5 24 18.5 24 12C24 5.5 30 2.5 36 5.8C42 9.1 42 14.9 36 18.2C30 21.5 24 18.5 24 12Z"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <span className={cn("hookit-fun-logo", className)} aria-hidden>
      <span className="hookit-fun-logo__h">H</span>
      <InfinityGlyph className="hookit-fun-logo__infinity" />
      <span className="hookit-fun-logo__rest">kit.fun</span>
    </span>
  );
}

import { cn } from "@/lib/utils";

function InfinityGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 12C12 7.8 9 5.2 6.4 6.8C3.8 8.4 3.8 15.6 6.4 17.2C9 18.8 12 16.2 12 12C12 7.8 15 5.2 17.6 6.8C20.2 8.4 20.2 15.6 17.6 17.2C15 18.8 12 16.2 12 12Z"
        stroke="currentColor"
        strokeWidth="2.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <span className={cn("hookit-fun-logo", className)} aria-hidden>
      <span className="hookit-fun-logo__word">
        <span>H</span>
        <InfinityGlyph className="hookit-fun-logo__infinity" />
        <span>kit</span>
      </span>
      <span className="hookit-fun-logo__suffix">.fun</span>
    </span>
  );
}

import { cn } from "@/lib/utils";

export function HookAvatarBadge({ className }: { className?: string }) {
  return (
    <span className={cn("hook-avatar-badge", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="hook-avatar-badge-icon" fill="none">
        <path
          d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
          fill="#1a1a1f"
          stroke="#3f3f46"
          strokeWidth="0.75"
        />
        <path d="M12 11v6M9.5 17h5" stroke="#52525b" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </span>
  );
}

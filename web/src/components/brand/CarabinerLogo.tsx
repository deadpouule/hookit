import { cn } from "@/lib/utils";

export function CarabinerLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      aria-hidden
      className={cn(
        "h-8 w-8 text-white [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.4))]",
        className,
      )}
    >
      <path
        d="M15.1 5.1C7.6 5.1 3.7 10.6 3.7 16.4c0 6.7 4.6 11.9 10.9 11.9 3.1 0 4.8-1.8 4.8-4.6v-5.4"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15V6.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M19.4 23.7c-1.5-.35-2.35-1.55-2.2-3.05"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <rect
        x="16.2"
        y="6.15"
        width="6.4"
        height="6.7"
        rx="1.45"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="19.4" cy="9.5" r="1.05" fill="currentColor" />
    </svg>
  );
}

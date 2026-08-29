import { cn } from "@/lib/utils";

export function LaunchRocketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("launch-coin-nav__rocket", className)} fill="none" aria-hidden>
      <g transform="rotate(-45 12 12)">
        <path
          d="M12 3.5c2.5 2.1 4.1 5.4 4.4 9.1.1.8 0 1.5-.2 2.2L12 20.8 7.8 14.8c-.3-.7-.4-1.5-.3-2.2.3-3.7 1.9-7 4.5-9.1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9.1 14.9 7.6 18.1M14.9 14.9 16.4 18.1"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M10.4 18.4c.8.7 1.8 1.1 2.9 1.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

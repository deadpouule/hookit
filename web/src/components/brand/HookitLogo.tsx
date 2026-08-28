import { cn } from "@/lib/utils";

type HookitLogoProps = {
  className?: string;
  size?: "xs" | "sm";
};

export function HookitLogo({ className, size = "xs" }: HookitLogoProps) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("hookit-logo", dim, className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
        fill="currentColor"
        stroke="rgb(255 255 255 / 0.35)"
        strokeWidth="0.6"
      />
      <path
        d="M12 11v6M9.5 17h5"
        stroke="rgb(255 255 255 / 0.55)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

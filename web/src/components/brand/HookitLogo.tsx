import { cn } from "@/lib/utils";

type HookitLogoProps = {
  className?: string;
  size?: "xs" | "sm";
};

export function HookitLogo({ className, size = "xs" }: HookitLogoProps) {
  const dim = size === "sm" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("hookit-logo-svg shrink-0", dim, className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M16.4 7.6C15 5.5 12.6 4.3 10.1 4.3 6.1 4.3 2.8 7.6 2.8 11.6s3.3 7.3 7.3 7.3c2.2 0 4.2-1 5.5-2.7"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 16.2V9.4"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <path
        d="M15.5 9.4h2.8a1.05 1.05 0 0 1 1.05 1.05v.75"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.05" cy="10.45" r="0.85" fill="currentColor" />
      <path
        d="M15.5 16.2v1.8"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

import Image from "next/image";

import { cn } from "@/lib/utils";

type HookitLogoProps = {
  className?: string;
  size?: "xs" | "sm";
};

const SIZES = {
  xs: 12,
  sm: 14,
} as const;

export function HookitLogo({ className, size = "xs" }: HookitLogoProps) {
  const px = SIZES[size];

  return (
    <Image
      src="/brand/hookit-mark.png"
      alt=""
      width={px}
      height={px}
      className={cn("hookit-logo-img shrink-0 object-contain", className)}
      aria-hidden
    />
  );
}

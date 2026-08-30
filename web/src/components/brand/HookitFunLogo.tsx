import Image from "next/image";

import { cn } from "@/lib/utils";

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/hookit-fun-logo.png"
      alt="hookit.fun"
      width={188}
      height={35}
      className={cn("hookit-fun-logo", className)}
      priority
      draggable={false}
    />
  );
}

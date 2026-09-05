import Image from "next/image";

import { cn } from "@/lib/utils";

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/hookit-fun-logo.png"
      alt="hookit.fun"
      width={934}
      height={176}
      className={cn("hookit-fun-logo h-auto w-auto", className)}
      priority
      draggable={false}
    />
  );
}

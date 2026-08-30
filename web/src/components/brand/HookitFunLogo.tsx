import Image from "next/image";

import { cn } from "@/lib/utils";

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/hookit-fun-logo.png"
      alt="hookit.fun"
      width={198}
      height={38}
      className={cn("hookit-fun-logo", className)}
      priority
      draggable={false}
    />
  );
}

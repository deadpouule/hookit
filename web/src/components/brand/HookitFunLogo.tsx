import Image from "next/image";

import { cn } from "@/lib/utils";

export function HookitFunLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn("hookit-fun-logo hookit-logo-motion", className)}
      role="img"
      aria-label="hookit.fun"
    >
      <Image
        src="/brand/hookit-type.png"
        alt=""
        fill
        sizes="(min-width: 640px) 184px, 145px"
        className="hookit-logo-layer hookit-logo-type"
        priority
        draggable={false}
      />
      <span className="hookit-logo-owl-wrap">
        <Image
          src="/brand/hookit-owl.png"
          alt=""
          fill
          sizes="(min-width: 640px) 184px, 145px"
          className="hookit-logo-layer hookit-logo-owl"
          priority
          draggable={false}
        />
        <span className="hookit-logo-lid hookit-logo-lid--l" />
        <span className="hookit-logo-lid hookit-logo-lid--r" />
      </span>
      <Image
        src="/brand/hookit-fun-suffix.png"
        alt=""
        fill
        sizes="(min-width: 640px) 184px, 145px"
        className="hookit-logo-layer hookit-logo-fun"
        priority
        draggable={false}
      />
    </span>
  );
}

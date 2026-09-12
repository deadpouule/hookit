import Image from "next/image";

import { cn } from "@/lib/utils";

export function WelcomeOwl({ className }: { className?: string }) {
  return (
    <span className={cn("welcome-owl", className)} role="img" aria-label="hookit">
      <Image
        src="/brand/hookit-owl-mark.png"
        alt=""
        fill
        sizes="(min-width: 640px) 148px, 112px"
        className="welcome-owl-mark"
        priority
        draggable={false}
      />
      <span className="welcome-owl-lid welcome-owl-lid--l" />
      <span className="welcome-owl-lid welcome-owl-lid--r" />
    </span>
  );
}

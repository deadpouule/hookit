import Image from "next/image";

import { cn } from "@/lib/utils";

export function InkAvatarBadge({ className }: { className?: string }) {
  return (
    <span className={cn("ink-avatar-badge", className)} aria-hidden>
      <Image
        src="/brand/ink-badge.png"
        alt=""
        width={14}
        height={14}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

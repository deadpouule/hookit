"use client";

import { QUICK_BUY_AMOUNTS } from "@/lib/market-tokens";
import { cn } from "@/lib/utils";

export function QuickBuy({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {QUICK_BUY_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          className={cn("quick-buy-btn", size === "sm" && "py-1 text-[10px]")}
          onClick={(e) => e.stopPropagation()}
        >
          [${amount}]
        </button>
      ))}
    </div>
  );
}

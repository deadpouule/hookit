"use client";

import { useRouter } from "next/navigation";

import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { QUICK_BUY_AMOUNTS } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Preset USD-ish amounts — open token desk with buy amount prefilled (ETH approx via /1000). */
export function QuickBuy({
  tokenId,
  size = "md",
  className,
}: {
  tokenId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("flex gap-1", className)}>
      {QUICK_BUY_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          {...TOOLBAR_BUTTON_PROPS}
          className={cn("quick-buy-btn", size === "sm" && "py-1 text-[10px]")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const ethApprox = (amount / 1000).toString();
            router.push(`${tokenHref(tokenId)}?buy=${ethApprox}&side=buy`);
          }}
        >
          ${amount}
        </button>
      ))}
    </div>
  );
}

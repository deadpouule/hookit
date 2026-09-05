"use client";

import { useRouter } from "next/navigation";

import { useEthUsd } from "@/hooks/useEthUsd";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { QUICK_BUY_AMOUNTS } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Preset USD amounts — open token desk with buy amount prefilled in ETH. */
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
  const ethUsd = useEthUsd();

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
            const ethApprox = ethUsd > 0 ? (amount / ethUsd).toPrecision(6) : (amount / 2500).toString();
            router.push(`${tokenHref(tokenId)}?buy=${ethApprox}&side=buy&usd=${amount}`);
          }}
        >
          ${amount}
        </button>
      ))}
    </div>
  );
}

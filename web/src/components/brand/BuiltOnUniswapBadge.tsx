import Image from "next/image";
import { cn } from "@/lib/utils";

type BuiltOnUniswapBadgeProps = {
  className?: string;
  /** Ticker strip uses title case; hero typewriter uses lowercase trailing text. */
  variant?: "ticker" | "inline";
  text?: string;
};

export function BuiltOnUniswapBadge({
  className,
  variant = "ticker",
  text,
}: BuiltOnUniswapBadgeProps) {
  const label = text ?? (variant === "inline" ? "build on uniswap" : "Built on Uniswap");

  return (
    <span
      className={cn(
        "built-on-uniswap-badge",
        variant === "inline" && "built-on-uniswap-badge--inline",
        className,
      )}
    >
      <Image
        src="/brand/uniswap-logo.png"
        alt=""
        width={variant === "inline" ? 28 : 20}
        height={variant === "inline" ? 28 : 20}
        className="built-on-uniswap-badge__logo"
        draggable={false}
      />
      <span className="built-on-uniswap-badge__text">{label}</span>
    </span>
  );
}

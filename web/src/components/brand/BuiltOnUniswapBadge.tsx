import Image from "next/image";
import { cn } from "@/lib/utils";

type BuiltOnUniswapBadgeProps = {
  className?: string;
  /** Hero uses transparent mark + Built on Uniswap; ticker uses compact png. */
  variant?: "ticker" | "inline" | "hero" | "compact";
  text?: string;
};

export function BuiltOnUniswapBadge({
  className,
  variant = "ticker",
  text,
}: BuiltOnUniswapBadgeProps) {
  const isHero = variant === "inline" || variant === "hero";
  const isCompact = variant === "compact";
  const label = text ?? "Built on Uniswap";
  const logoSrc = isHero || isCompact ? "/brand/uniswap-mark.png" : "/brand/uniswap-logo.png";
  const logoPx = isHero ? 56 : 20;

  return (
    <span
      className={cn(
        "built-on-uniswap-badge",
        isHero && "built-on-uniswap-badge--hero",
        isCompact && "built-on-uniswap-badge--compact",
        className,
      )}
    >
      <Image
        src={logoSrc}
        alt=""
        width={logoPx}
        height={logoPx}
        className="built-on-uniswap-badge__logo h-auto w-auto"
        draggable={false}
      />
      <span className="built-on-uniswap-badge__text">{label}</span>
    </span>
  );
}

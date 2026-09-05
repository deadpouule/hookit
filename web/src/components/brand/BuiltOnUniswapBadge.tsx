import Image from "next/image";
import { cn } from "@/lib/utils";

type BuiltOnUniswapBadgeProps = {
  className?: string;
  /** Hero uses transparent mark + Built on Uniswap; ticker uses compact png. */
  variant?: "ticker" | "inline" | "hero";
  text?: string;
};

export function BuiltOnUniswapBadge({
  className,
  variant = "ticker",
  text,
}: BuiltOnUniswapBadgeProps) {
  const isHero = variant === "inline" || variant === "hero";
  const label = text ?? (isHero ? "Built on Uniswap" : "Built on Uniswap");
  const logoSrc = isHero ? "/brand/uniswap-mark.png" : "/brand/uniswap-logo.png";

  return (
    <span
      className={cn(
        "built-on-uniswap-badge",
        isHero && "built-on-uniswap-badge--hero",
        className,
      )}
    >
      <Image
        src={logoSrc}
        alt=""
        width={isHero ? 56 : 20}
        height={isHero ? 56 : 20}
        className="built-on-uniswap-badge__logo h-auto w-auto"
        draggable={false}
      />
      <span className="built-on-uniswap-badge__text">{label}</span>
    </span>
  );
}

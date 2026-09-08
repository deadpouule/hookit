import Image from "next/image";
import { cn } from "@/lib/utils";

export const UNISWAP_BADGE_LABEL = "Built on Uniswap";

type BuiltOnUniswapBadgeProps = {
  className?: string;
  /** Hero uses transparent mark + Built on Uniswap; ticker uses compact png. */
  variant?: "ticker" | "inline" | "hero" | "compact";
  text?: string;
  /** Partial label while the hero typewriter is writing. Full label when omitted. */
  typedText?: string;
  showCaret?: boolean;
};

export function BuiltOnUniswapBadge({
  className,
  variant = "ticker",
  text,
  typedText,
  showCaret = false,
}: BuiltOnUniswapBadgeProps) {
  const isHero = variant === "inline" || variant === "hero";
  const isCompact = variant === "compact";
  const label = text ?? UNISWAP_BADGE_LABEL;
  const visible = typedText ?? label;
  const logoSrc = isHero || isCompact ? "/brand/uniswap-mark.png" : "/brand/uniswap-logo.png";
  const logoPx = isHero ? 56 : 20;
  const typewriter = typedText != null;
  const tintLogo = isHero || isCompact;

  return (
    <span
      className={cn(
        "built-on-uniswap-badge",
        isHero && "built-on-uniswap-badge--hero",
        isCompact && "built-on-uniswap-badge--compact",
        className,
      )}
    >
      {tintLogo ? (
        <span
          className="built-on-uniswap-badge__logo"
          aria-hidden
          style={{
            WebkitMaskImage: `url(${logoSrc})`,
            maskImage: `url(${logoSrc})`,
          }}
        />
      ) : (
        <Image
          src={logoSrc}
          alt=""
          width={logoPx}
          height={logoPx}
          className="built-on-uniswap-badge__logo h-auto w-auto"
          draggable={false}
        />
      )}
      {typewriter ? (
        <span className="built-on-uniswap-badge__text built-on-uniswap-badge__text--typed">
          <span className="built-on-uniswap-badge__sizer" aria-hidden>
            {label}
          </span>
          <span className="built-on-uniswap-badge__live">
            {visible}
            {showCaret ? (
              <span className="hero-cursor hero-cursor--in-badge" aria-hidden>
                |
              </span>
            ) : null}
          </span>
        </span>
      ) : (
        <span className="built-on-uniswap-badge__text">{visible}</span>
      )}
    </span>
  );
}

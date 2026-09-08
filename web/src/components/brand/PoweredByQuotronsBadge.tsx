import Image from "next/image";
import { cn } from "@/lib/utils";

export const QUOTRONS_BADGE_LABEL = "Powered by Quotrons";

type PoweredByQuotronsBadgeProps = {
  className?: string;
  variant?: "hero" | "compact";
  /** Partial label while the hero typewriter is writing. Full label when omitted. */
  typedText?: string;
  showCaret?: boolean;
};

export function PoweredByQuotronsBadge({
  className,
  variant = "hero",
  typedText,
  showCaret = false,
}: PoweredByQuotronsBadgeProps) {
  const isHero = variant === "hero";
  const isCompact = variant === "compact";
  const label = QUOTRONS_BADGE_LABEL;
  const visible = typedText ?? label;
  const logoPx = isHero ? 64 : 20;
  const typewriter = typedText != null;

  return (
    <span
      className={cn(
        "powered-by-quotrons-badge",
        isHero && "powered-by-quotrons-badge--hero",
        isCompact && "powered-by-quotrons-badge--compact",
        className,
      )}
    >
      <Image
        src="/brand/quotrons-mark.png"
        alt=""
        width={logoPx}
        height={logoPx}
        className="powered-by-quotrons-badge__logo"
        draggable={false}
      />
      {typewriter ? (
        <span className="powered-by-quotrons-badge__text powered-by-quotrons-badge__text--typed">
          <span className="powered-by-quotrons-badge__sizer" aria-hidden>
            {label}
          </span>
          <span className="powered-by-quotrons-badge__live">
            {visible}
            {showCaret ? (
              <span className="hero-cursor hero-cursor--in-badge" aria-hidden>
                |
              </span>
            ) : null}
          </span>
        </span>
      ) : (
        <span className="powered-by-quotrons-badge__text">{visible}</span>
      )}
    </span>
  );
}

import Image from "next/image";
import { cn } from "@/lib/utils";

export const QUOTRONS_BADGE_LABEL = "Powered by Quotrons";
const BY = "Powered by";

function splitTyped(typed: string): { by: string; name: string } {
  if (typed.length <= BY.length) return { by: typed, name: "" };
  return { by: BY, name: typed.slice(BY.length).trimStart() };
}

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
  const logoPx = isHero ? 64 : 20;
  const visible = typedText ?? QUOTRONS_BADGE_LABEL;
  const typed = splitTyped(visible);
  const full = splitTyped(QUOTRONS_BADGE_LABEL);

  return (
    <span
      className={cn(
        "powered-by-quotrons-badge",
        isHero && "powered-by-quotrons-badge--hero",
        !isHero && "powered-by-quotrons-badge--compact",
        className,
      )}
    >
      <Image
        src="/brand/quotrons-mark.png"
        alt=""
        width={logoPx}
        height={logoPx}
        className="powered-by-quotrons-badge__logo h-auto w-auto"
        draggable={false}
      />
      <span className="powered-by-quotrons-badge__text">
        <span className="powered-by-quotrons-badge__sizer" aria-hidden>
          <span className="powered-by-quotrons-badge__by">{full.by}</span>
          <span className="powered-by-quotrons-badge__name">{full.name}</span>
        </span>
        <span className="powered-by-quotrons-badge__typed">
          <span className="powered-by-quotrons-badge__by">
            {typed.by}
            {showCaret && typed.name.length === 0 ? (
              <span className="hero-cursor hero-cursor--in-badge" aria-hidden>
                |
              </span>
            ) : null}
          </span>
          <span className="powered-by-quotrons-badge__name">
            {typed.name}
            {showCaret && typed.name.length > 0 ? (
              <span className="hero-cursor hero-cursor--in-badge" aria-hidden>
                |
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </span>
  );
}

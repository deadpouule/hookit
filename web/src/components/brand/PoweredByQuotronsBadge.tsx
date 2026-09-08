import Image from "next/image";
import { cn } from "@/lib/utils";

type PoweredByQuotronsBadgeProps = {
  className?: string;
  variant?: "hero" | "compact";
};

export function PoweredByQuotronsBadge({
  className,
  variant = "hero",
}: PoweredByQuotronsBadgeProps) {
  const isHero = variant === "hero";
  const logoPx = isHero ? 56 : 20;

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
        <span className="powered-by-quotrons-badge__by">Powered by</span>
        <span className="powered-by-quotrons-badge__name">Quotrons</span>
      </span>
    </span>
  );
}

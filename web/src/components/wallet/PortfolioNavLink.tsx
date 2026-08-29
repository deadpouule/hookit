import Link from "next/link";

import { PortfolioMark } from "@/components/wallet/PortfolioMark";
import { cn } from "@/lib/utils";

export function PortfolioNavLink({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/portfolio"
      onClick={onClick}
      className={cn("portfolio-nav-btn", className)}
      aria-label="Portfolio"
    >
      <PortfolioMark className="h-[18px] w-[18px]" />
    </Link>
  );
}

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import type { MarketToken } from "@/lib/market-tokens";
import { tokenAgeLabel } from "@/lib/market-tokens";
import { cn } from "@/lib/utils";

/** COPY / OG overlay on the token art — top-right corner. */
export function TokenCopyBadge({ token }: { token: MarketToken }) {
  if (token.isCopycat) {
    return (
      <span className="token-copy-badge" title="Copycat launch — verify the contract address">
        COPY
      </span>
    );
  }
  if (token.isOriginal) {
    return (
      <span className="token-og-badge" title="Original launch — first of this name & ticker">
        OG
      </span>
    );
  }
  return null;
}

/** Type badges row — Master, Customs, RWA. Normal classic tokens show no type badge. */
export function TokenTypeBadges({ token }: { token: MarketToken }) {
  const badges: ReactNode[] = [];

  if (token.hookType === "Master" || (token.rail === "master" && token.hookType !== "Custom")) {
    badges.push(
      <span key="master" className="token-type-badge token-type-badge--master">
        Master
      </span>,
    );
  } else if (token.hookType === "Custom" || token.kind === "sushi") {
    badges.push(
      <span key="custom" className="token-type-badge token-type-badge--custom">
        Customs
        <AlertTriangle className="token-custom-warn" aria-hidden />
      </span>,
    );
  }

  if (token.isRwa) {
    badges.push(
      <span key="rwa" className="token-type-badge token-type-badge--rwa">
        rwa
      </span>,
    );
  }

  if (token.rail === "classic" && token.hookType === "Classic") {
    badges.push(
      <span key="curve" className="token-type-badge token-type-badge--curve">
        curve
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className="token-type-badges">{badges}</div>;
}

/** Compact meta line under the name — price hint + age. */
export function TokenMetaLine({ token, className }: { token: MarketToken; className?: string }) {
  return (
    <p className={cn("token-meta-line", className)}>
      <span className="token-meta-age">{tokenAgeLabel(token.launchedAt)}</span>
      {token.isCopycat && <span className="token-meta-copy">copy</span>}
    </p>
  );
}

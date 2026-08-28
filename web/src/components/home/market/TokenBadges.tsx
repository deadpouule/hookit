import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import type { MarketToken } from "@/lib/market-tokens";
import { tokenAgeLabel } from "@/lib/market-tokens";
import { pairingBadgeClassName, pairingCurveBadge } from "@/lib/pairing-badge";
import { cn } from "@/lib/utils";

import { CustomsGlyph, MasterHookGlyph, RwaGlyph } from "./CategoryGlyphs";

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
      <span className="token-og-badge" title="Original launch — first token with this ticker">
        OG
      </span>
    );
  }
  return null;
}

/** Type badges row — Master, Customs, RWA pools, pairing curve (colored). */
export function TokenTypeBadges({ token }: { token: MarketToken }) {
  const badges: ReactNode[] = [];

  if (token.hookType === "Master" || (token.rail === "master" && token.hookType !== "Custom")) {
    badges.push(
      <span key="master" className="token-type-badge token-type-badge--master">
        <MasterHookGlyph className="token-type-badge-glyph" />
        Master
      </span>,
    );
  } else if (token.hookType === "Custom" || token.kind === "sushi") {
    badges.push(
      <span key="custom" className="token-type-badge token-type-badge--custom">
        <CustomsGlyph className="token-type-badge-glyph" />
        Customs
        <AlertTriangle className="token-custom-warn" aria-hidden />
      </span>,
    );
  }

  if (token.isRwa) {
    badges.push(
      <span key="rwa" className="token-type-badge token-type-badge--rwa">
        <RwaGlyph className="token-type-badge-glyph" />
        RWA pools
      </span>,
    );
  }

  const pairing = pairingCurveBadge(token.quoteAsset, token.quoteAddress);
  if (pairing) {
    badges.push(
      <span key="pairing" className={pairingBadgeClassName(pairing.tone)}>
        {pairing.label}
      </span>,
    );
  } else if (token.rail === "classic" && token.hookType === "Classic") {
    badges.push(
      <span key="curve" className="token-type-badge token-type-badge--curve">
        curve
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className="token-type-badges">{badges}</div>;
}

/** Compact meta line under the name — age + copy hint. */
export function TokenMetaLine({ token, className }: { token: MarketToken; className?: string }) {
  return (
    <p className={cn("token-meta-line", className)}>
      <span className="token-meta-age">{tokenAgeLabel(token.launchedAt)}</span>
      {token.isCopycat && <span className="token-meta-copy">copy</span>}
    </p>
  );
}

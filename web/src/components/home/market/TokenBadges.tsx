"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import type { MasterHookId } from "@/lib/master-hooks";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenAgeLabel } from "@/lib/market-tokens";
import { PairingMark } from "@/components/launch/PairingMark";
import {
  isMultiPairPool,
  pairingBadgeClassName,
  pairingBadgesForPool,
} from "@/lib/pairing-badge";
import { cn } from "@/lib/utils";

import { CustomsGlyph, MasterHookGlyph, RwaGlyph } from "./CategoryGlyphs";
import { MasterHookTokenBadgeFilter } from "./MasterHookFilterMenu";

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

function PairingBadgeRow({
  pairing,
}: {
  pairing: NonNullable<MarketToken["pairings"]>[number];
}) {
  return (
    <span className={pairingBadgeClassName(pairing.tone)}>
      <span className="token-type-badge-pairing-prefix">paired with</span>
      <PairingMark id={pairing.pairingId} size="sm" />
      <span className="token-type-badge-pairing-name">{pairing.name}</span>
    </span>
  );
}

/** Type badges row — Master, Customs, RWA pools, multi-pair, pairing legs. */
export function TokenTypeBadges({
  token,
  masterHookFilters,
  onMasterHookFiltersChange,
}: {
  token: MarketToken;
  masterHookFilters?: MasterHookId[];
  onMasterHookFiltersChange?: (hooks: MasterHookId[]) => void;
}) {
  const badges: ReactNode[] = [];
  const isMaster =
    token.hookType === "Master" || (token.rail === "master" && token.hookType !== "Custom");

  if (isMaster) {
    badges.push(
      onMasterHookFiltersChange ? (
        <MasterHookTokenBadgeFilter
          key="master"
          selectedHooks={masterHookFilters ?? []}
          onSelectedHooksChange={onMasterHookFiltersChange}
          className="token-type-badge token-type-badge--master relative z-20 cursor-pointer transition hover:brightness-110"
        />
      ) : (
        <span key="master" className="token-type-badge token-type-badge--master">
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master
        </span>
      ),
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

  const pairings = token.pairings ?? pairingBadgesForPool(token);
  const isMulti = isMultiPairPool(token);

  if (isMulti) {
    badges.push(
      <span key="multi-pair" className="token-type-badge token-type-badge--multi-pair">
        Multi pair
      </span>,
    );
  }

  for (const pairing of pairings) {
    badges.push(<PairingBadgeRow key={`pairing-${pairing.pairingId}`} pairing={pairing} />);
  }

  if (pairings.length === 0 && token.rail === "classic" && token.hookType === "Classic") {
    badges.push(
      <span key="curve" className="token-type-badge token-type-badge--curve">
        curve
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className={cn("token-type-badges", onMasterHookFiltersChange && "relative z-20")}>
      {badges}
    </div>
  );
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

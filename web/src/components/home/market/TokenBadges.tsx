"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { PairingMark } from "@/components/launch/PairingMark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MasterHookId } from "@/lib/master-hooks";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenAgeLabel } from "@/lib/market-tokens";
import {
  isMultiPairPool,
  pairingBadgeClassName,
  pairingBadgesForPool,
} from "@/lib/pairing-badge";
import { cn } from "@/lib/utils";

import { CustomsGlyph, MasterHookGlyph, MultiPairGlyph, RwaGlyph } from "./CategoryGlyphs";
import { MasterHookTokenBadgeFilter } from "./MasterHookFilterMenu";

const BADGE_TIPS = {
  master: "Uniswap v4 token with our programmable hooks.",
  customs: "Custom unaudited hook code — treat as higher risk.",
  rwa: "Liquidity is paired with a real-world asset token (stock, index, etc.).",
  multiPair: "Trades across multiple quote pools at once.",
  pairing: (name: string) => `Pool liquidity is paired against ${name}.`,
} as const;

function BadgeTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        showArrow={false}
        className="max-w-[240px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/** COPY / OG overlay on the token art — top-right corner. */
export function TokenCopyBadge({ token }: { token: MarketToken }) {
  if (token.isCopycat) {
    return (
      <BadgeTip tip="Copycat launch — verify the contract address before trading.">
        <span className="token-copy-badge" title="Copycat launch — verify the contract address">
          COPY
        </span>
      </BadgeTip>
    );
  }
  if (token.isOriginal) {
    return (
      <BadgeTip tip="Original launch — first token with this ticker on Hookit.">
        <span className="token-og-badge" title="Original launch — first token with this ticker">
          OG
        </span>
      </BadgeTip>
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
    <BadgeTip tip={BADGE_TIPS.pairing(pairing.name)}>
      <span className={pairingBadgeClassName(pairing.tone)}>
        <span className="token-type-badge-pairing-prefix">Paired with</span>
        <PairingMark id={pairing.pairingId} size="sm" />
        <span className="token-type-badge-pairing-name">{pairing.name}</span>
      </span>
    </BadgeTip>
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
      <BadgeTip key="master" tip={BADGE_TIPS.master}>
        {onMasterHookFiltersChange ? (
          <MasterHookTokenBadgeFilter
            selectedHooks={masterHookFilters ?? []}
            onSelectedHooksChange={onMasterHookFiltersChange}
            className="token-type-badge token-type-badge--master relative z-20 cursor-pointer transition hover:brightness-110"
          />
        ) : (
          <span className="token-type-badge token-type-badge--master">
            <MasterHookGlyph className="token-type-badge-glyph" />
            Master
          </span>
        )}
      </BadgeTip>,
    );
  } else if (token.hookType === "Custom" || token.kind === "sushi") {
    badges.push(
      <BadgeTip key="custom" tip={BADGE_TIPS.customs}>
        <span className="token-type-badge token-type-badge--custom">
          <CustomsGlyph className="token-type-badge-glyph" />
          Customs
          <AlertTriangle className="token-custom-warn" aria-hidden />
        </span>
      </BadgeTip>,
    );
  }

  if (token.isRwa) {
    badges.push(
      <BadgeTip key="rwa" tip={BADGE_TIPS.rwa}>
        <span className="token-type-badge token-type-badge--rwa">
          <RwaGlyph className="token-type-badge-glyph" />
          RWA pools
        </span>
      </BadgeTip>,
    );
  }

  const pairings = token.pairings ?? pairingBadgesForPool(token);
  const isMulti = isMultiPairPool(token);

  if (isMulti) {
    const legs = pairings.map((pairing) => pairing.name).join(" · ");
    badges.push(
      <BadgeTip key="multi-pair" tip={`${BADGE_TIPS.multiPair} ${legs}`}>
        <span className="token-type-badge token-type-badge--multi-pair">
          <MultiPairGlyph className="token-type-badge-glyph" />
          Multi pair
          <span className="token-type-badge-multi-pair-logos">
            {pairings.map((pairing) => (
              <PairingMark key={pairing.pairingId} id={pairing.pairingId} size="sm" />
            ))}
          </span>
        </span>
      </BadgeTip>,
    );
  } else {
    for (const pairing of pairings) {
      badges.push(<PairingBadgeRow key={`pairing-${pairing.pairingId}`} pairing={pairing} />);
    }
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

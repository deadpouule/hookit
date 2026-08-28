"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { HookitLogo } from "@/components/brand/HookitLogo";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  bondProgress,
  isBonded,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

import { CopyContractButton } from "./CopyContractButton";
import { TokenArt } from "./TokenArt";
import { TokenCopyBadge, TokenTypeBadges } from "./TokenBadges";

export function BondMeter({ token }: { token: MarketToken }) {
  if (token.rail !== "classic" || token.hookType !== "Classic") return null;
  if (token.bondingPhase !== 0) {
    return <p className="text-[10px] font-medium text-[#10b981]">Graduated</p>;
  }
  if (isBonded(token)) return null;

  const progress = bondProgress(token);

  return (
    <div className="bond-meter">
      <div className="bond-track" aria-hidden>
        <span className="bond-fill" style={{ width: `${progress}%` }} />
      </div>
      <p>{progress}% bonded</p>
    </div>
  );
}

export function MarketTokenCard({
  token,
  masterHookFilters,
  onMasterHookFiltersChange,
}: {
  token: MarketToken;
  masterHookFilters?: import("@/lib/master-hooks").MasterHookId[];
  onMasterHookFiltersChange?: (hooks: import("@/lib/master-hooks").MasterHookId[]) => void;
}) {
  const router = useRouter();
  const href = tokenHref(token.id);

  return (
    <article
      className="market-card group relative cursor-pointer overflow-hidden border border-transparent transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
      onClick={() => router.push(href)}
    >
      <div className="relative">
        <TokenArt
          token={token}
          className="token-thumb pointer-events-none flex items-center justify-center"
          glyphClassName="text-3xl drop-shadow-lg"
        />
        <TokenCopyBadge token={token} />
      </div>

      <div className="token-card-body">
        <div className="token-card-head">
          <h3 className="token-card-name truncate">{token.name}</h3>
          <div className="token-card-ticker-row">
            <p className="token-card-ticker truncate">
              <HookitLogo size="xs" className="token-card-brand-logo" />
              ${token.ticker}
            </p>
            <CopyContractButton token={token} />
          </div>
        </div>

        <TokenTypeBadges
          token={token}
          masterHookFilters={masterHookFilters}
          onMasterHookFiltersChange={onMasterHookFiltersChange}
        />

        <dl className="pointer-events-none token-card-stats">
          <div>
            <dt>Mcap</dt>
            <dd>{formatUsd(token.marketCap)}</dd>
          </div>
          <div>
            <dt>Vol</dt>
            <dd>{formatUsd(token.volume)}</dd>
          </div>
          <div>
            <dt>24h</dt>
            <dd className={token.change24h >= 0 ? "up" : "down"}>
              {formatPercent(token.change24h, true)}
            </dd>
          </div>
        </dl>

        <BondMeter token={token} />
      </div>
      <Link href={href} className="absolute inset-0 z-10" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

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
      <p className="bond-meter-label">{progress}% bonded</p>
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

  const prefetchToken = useCallback(() => {
    if (typeof window === "undefined") return;
    void fetch(`/api/launches/${encodeURIComponent(token.id)}`, {
      priority: "low",
    }).catch(() => undefined);
  }, [token.id]);

  return (
    <article
      className="market-card group relative cursor-pointer overflow-hidden border border-transparent transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
      onClick={() => router.push(href)}
      onMouseEnter={prefetchToken}
      onFocus={prefetchToken}
    >
      <div className="relative">
        <TokenArt
          token={token}
          className="token-thumb pointer-events-none flex items-center justify-center"
          glyphClassName="text-3xl drop-shadow-lg"
        />
        <TokenCopyBadge token={token} />
        {token.hookTaxBps != null && token.hookTaxBps > 0 && !token.dynamicFees && (
          <span className="absolute top-2 left-2 z-20 rounded-md border border-rose-400/35 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100 backdrop-blur-sm">
            Fixed {(100 + token.hookTaxBps) / 100}%
          </span>
        )}
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

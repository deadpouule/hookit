"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPercent, formatUsd } from "@/lib/format";
import {
  bondProgress,
  isBonded,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

import { TokenArt } from "./TokenArt";
import { TokenCopyBadge, TokenMetaLine, TokenTypeBadges } from "./TokenBadges";

export function BondMeter({ token }: { token: MarketToken }) {
  // Bonding curve bar only for normal classic tokens still on the curve.
  if (token.rail !== "classic" || token.hookType !== "Classic") return null;
  if (token.bondingPhase !== 0) {
    return <p className="text-[11px] font-medium text-[#10b981]">Graduated</p>;
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

export function MarketTokenCard({ token }: { token: MarketToken }) {
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
          glyphClassName="text-4xl drop-shadow-lg"
        />
        <TokenCopyBadge token={token} />
      </div>

      <div className="token-card-body">
        <h3 className="pointer-events-none truncate">
          {token.name} <span>${token.ticker}</span>
        </h3>

        <TokenMetaLine token={token} />

        <TokenTypeBadges token={token} />

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
            <dt>1h</dt>
            <dd className={token.change1h >= 0 ? "up" : "down"}>{formatPercent(token.change1h, true)}</dd>
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

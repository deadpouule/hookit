"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatCompactUsd } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

import { TokenArt } from "./TokenArt";
import { TokenCopyBadge, TokenTypeBadges } from "./TokenBadges";

export function MobileTokenGridCard({ token }: { token: MarketToken }) {
  const router = useRouter();
  const href = tokenHref(token.id);

  return (
    <article
      className="mobile-token-grid-card"
      onClick={() => router.push(href)}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
    >
      <div className="mobile-token-grid-card__art">
        <TokenArt
          token={token}
          className="flex h-full w-full items-center justify-center"
          glyphClassName="text-3xl"
        />
        <TokenCopyBadge token={token} />
      </div>

      <div className="mobile-token-grid-card__body">
        <h3 className="mobile-token-grid-card__name">{token.name}</h3>
        <p className="mobile-token-grid-card__ticker">${token.ticker}</p>

        <dl className="mobile-token-grid-card__stats">
          <div>
            <dt>FDV</dt>
            <dd>{formatCompactUsd(token.marketCap)}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>{formatCompactUsd(token.volume)}</dd>
          </div>
        </dl>

        <div className="mobile-token-grid-card__badges">
          <TokenTypeBadges token={token} />
        </div>
      </div>

      <Link href={href} className="absolute inset-0 z-0" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}

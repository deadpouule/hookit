"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  bondProgress,
  isBonded,
  truncateCreator,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

import { QuickBuy } from "./QuickBuy";
import { TokenArt } from "./TokenArt";

export function BondMeter({ token }: { token: MarketToken }) {
  // Master launches skip the bonding meter.
  if (token.rail === "master") return null;
  if (isBonded(token) && token.rail !== "classic") return null;
  if (token.rail === "classic" && token.bondingPhase !== 0) {
    return <p className="text-[11px] font-medium text-[#10b981]">Graduated</p>;
  }
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
  const [copied, setCopied] = useState(false);
  const href = tokenHref(token.id);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await copyToClipboard(token.creator))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <article
      className="market-card group relative cursor-pointer overflow-hidden border border-transparent transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
      onClick={() => router.push(href)}
    >
      <TokenArt
        token={token}
        className="token-thumb pointer-events-none flex items-center justify-center"
        glyphClassName="text-4xl drop-shadow-lg"
      />

      <div className="token-card-body">
        <h3 className="pointer-events-none truncate">
          {token.name} <span>${token.ticker}</span>
        </h3>

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

        <QuickBuy tokenId={token.id} size="sm" className="relative z-20" />

        <button type="button" onClick={copy} className="token-card-creator relative z-20">
          <span>Creator</span>
          <span className="font-mono">{truncateCreator(token.creator)}</span>
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 opacity-50" />}
        </button>
      </div>
      <Link href={href} className="absolute inset-0 z-10" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}

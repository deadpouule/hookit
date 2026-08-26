"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Lock } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { formatPercent, formatUsd } from "@/lib/format";
import {
  bondProgress,
  isBonded,
  tokenAgeLabel,
  truncateCreator,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";

import { QuickBuy } from "./QuickBuy";
import { TokenArt } from "./TokenArt";

export function BondMeter({ token }: { token: MarketToken }) {
  const bonded = isBonded(token);
  const progress = bondProgress(token);

  if (bonded) {
    return (
      <p className="bond-done">
        <Lock className="h-3 w-3" />
        graduated · locked
      </p>
    );
  }

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
      className="market-card token-card group relative cursor-pointer overflow-hidden border border-transparent transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_12px_rgba(149,20,209,0.45)]"
      onClick={() => router.push(href)}
    >
      <TokenArt
        token={token}
        className="pointer-events-none flex aspect-square items-center justify-center"
        glyphClassName="text-3xl drop-shadow-lg sm:text-4xl"
      />

      <div className="token-card-body">
        <h3 className="pointer-events-none truncate">
          {token.name}{" "}
          <span>${token.ticker}</span>
        </h3>

        <p className="token-mcap pointer-events-none">{formatUsd(token.marketCap)}</p>

        <div className="token-card-meta">
          <button type="button" onClick={copy} className="relative z-20">
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            copy ca
          </button>
          <span>{tokenAgeLabel(token.launchedAt)}</span>
        </div>

        <dl className="pointer-events-none token-card-stats">
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

        <QuickBuy size="sm" className="relative z-20 mt-1.5" />

        <p className="token-card-creator pointer-events-none">
          Creator {truncateCreator(token.creator)}
        </p>
      </div>
      <Link href={href} className="absolute inset-0 z-10" aria-label={`${token.name} $${token.ticker}`}>
        <span className="sr-only">
          {token.name} ${token.ticker}
        </span>
      </Link>
    </article>
  );
}

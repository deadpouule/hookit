"use client";

import Link from "next/link";

import { formatPercent } from "@/lib/format";
import type { MarketToken } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { TokenArt } from "./TokenArt";

export function MobileTicker({ tokens }: { tokens: MarketToken[] }) {
  const items = tokens.slice(0, 12);
  if (items.length === 0) return null;

  const loop = [...items, ...items];

  return (
    <div className="stonk-ticker md:hidden" aria-hidden>
      <div className="stonk-ticker-track">
        {loop.map((token, index) => {
          const up = token.change24h >= 0;
          return (
            <Link
              key={`${token.id}-${index}`}
              href={tokenHref(token.id)}
              className="stonk-ticker-item"
            >
              <TokenArt
                token={token}
                className="h-4 w-4 overflow-hidden rounded-full"
                glyphClassName="text-[8px]"
              />
              <span className="stonk-ticker-name">{token.ticker}</span>
              <span className={cn("stonk-ticker-chg", up ? "up" : "down")}>
                {up ? "▲" : "▼"} {formatPercent(Math.abs(token.change24h))}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

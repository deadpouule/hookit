"use client";

import { useRouter } from "next/navigation";

import { TokenArt } from "@/components/home/market/TokenArt";
import { poolToMarketToken } from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import type { TokenPool } from "@/lib/types";

export function HookLiveTokens({
  pools,
  limit = 6,
}: {
  pools: TokenPool[];
  limit?: number;
}) {
  const router = useRouter();
  const shown = pools.slice(0, limit);
  if (shown.length === 0) return null;
  const extra = pools.length - shown.length;

  return (
    <span className="hook-live-tokens">
      {shown.map((pool) => {
        const token = poolToMarketToken(pool);
        return (
          <span
            key={token.id}
            className="hook-live-token"
            title={`${token.name} $${token.ticker}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(tokenHref(token.id));
            }}
          >
            <TokenArt
              token={token}
            className="h-full w-full rounded-full"
            glyphClassName="flex h-full w-full items-center justify-center text-[9px] font-bold text-white"
            />
          </span>
        );
      })}
      {extra > 0 ? <span className="hook-live-token-more">+{extra}</span> : null}
    </span>
  );
}

"use client";

import { TokenImage } from "@/components/token/TokenImage";
import { cn } from "@/lib/utils";
import type { MarketToken } from "@/lib/market-tokens";
import { isTokenMediaUri } from "@/lib/token-metadata";

export function TokenArt({
  token,
  className,
  glyphClassName,
}: {
  token: MarketToken;
  className?: string;
  glyphClassName?: string;
}) {
  const mediaUri =
    token.imageUrl || (isTokenMediaUri(token.emoji) ? token.emoji : undefined);
  const fallback = token.ticker.slice(0, 1).toUpperCase();

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: token.art }}>
      <div
        className="absolute -top-6 -right-4 h-24 w-24 rounded-full opacity-50 blur-2xl"
        style={{ background: token.artAccent }}
      />
      <div
        className="absolute -bottom-8 -left-6 h-28 w-28 rounded-full opacity-40 blur-2xl"
        style={{ background: token.artAccent }}
      />
      {mediaUri ? (
        <TokenImage
          uri={mediaUri}
          className="relative z-[1] h-full w-full object-cover"
          fallback={
            <span className={cn("relative z-[1] select-none", glyphClassName)}>
              {fallback}
            </span>
          }
        />
      ) : (
        <span className={cn("relative z-[1] select-none", glyphClassName)}>
          {isTokenMediaUri(token.emoji) ? fallback : token.emoji || fallback}
        </span>
      )}
    </div>
  );
}

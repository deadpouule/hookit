"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { MarketToken } from "@/lib/market-tokens";
import { isTokenMediaUri, resolveMediaUrl } from "@/lib/token-metadata";

export function TokenArt({
  token,
  className,
  glyphClassName,
}: {
  token: MarketToken;
  className?: string;
  glyphClassName?: string;
}) {
  const mediaSrc = resolveMediaUrl(
    token.imageUrl || (isTokenMediaUri(token.emoji) ? token.emoji : undefined),
  );
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(mediaSrc) && !broken;
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
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaSrc}
          alt=""
          className="relative z-[1] h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className={cn("relative z-[1] select-none", glyphClassName)}>
          {isTokenMediaUri(token.emoji) ? fallback : token.emoji || fallback}
        </span>
      )}
    </div>
  );
}

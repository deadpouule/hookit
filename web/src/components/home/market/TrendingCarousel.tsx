"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import type { MarketToken } from "@/lib/market-tokens";
import { cn } from "@/lib/utils";

import { TrendingTokenCard } from "./TrendingTokenCard";

const MAX_TRENDING = 8;
const VISIBLE_DESKTOP = 5;
const VISIBLE_MOBILE = 2;

type TrendingCarouselProps = {
  tokens: MarketToken[];
};

export function TrendingCarousel({ tokens }: TrendingCarouselProps) {
  const items = tokens.slice(0, MAX_TRENDING);
  const [offset, setOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_DESKTOP);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setVisibleCount(media.matches ? VISIBLE_DESKTOP : VISIBLE_MOBILE);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setOffset((current) => Math.min(current, Math.max(0, items.length - visibleCount)));
  }, [items.length, visibleCount]);

  const maxOffset = Math.max(0, items.length - visibleCount);
  const canPrev = offset > 0;
  const canNext = offset < maxOffset;

  return (
    <div className="trending-carousel">
      <button
        type="button"
        className={cn("trending-carousel-nav", !canPrev && "trending-carousel-nav--disabled")}
        onClick={() => setOffset((current) => Math.max(0, current - 1))}
        disabled={!canPrev}
        aria-label="Show previous trending tokens"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="trending-carousel-viewport">
        <div
          className="trending-carousel-track"
          style={{
            transform: `translateX(-${(offset * 100) / visibleCount}%)`,
            ["--trending-visible" as string]: visibleCount,
          }}
        >
          {items.map((token) => (
            <TrendingTokenCard key={token.id} token={token} />
          ))}
        </div>
      </div>

      <button
        type="button"
        className={cn("trending-carousel-nav", !canNext && "trending-carousel-nav--disabled")}
        onClick={() => setOffset((current) => Math.min(maxOffset, current + 1))}
        disabled={!canNext}
        aria-label="Show next trending tokens"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

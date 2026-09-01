"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { BuiltOnUniswapBadge } from "@/components/brand/BuiltOnUniswapBadge";

const SEGMENT_COUNT = 12;
const SWITCH_MS = 4500;

function LiveOnInkUnit() {
  return (
    <span className="live-on-ink-ticker__unit inline-flex shrink-0 items-center">
      <span className="live-on-ink-ticker__label">
        <span className="live-on-ink-ticker__live">LIVE</span>
        <span className="live-on-ink-ticker__on"> ON INK</span>
      </span>
      <Image
        src="/brand/ink-ticker.png"
        alt=""
        width={26}
        height={26}
        className="live-on-ink-ticker__logo"
        draggable={false}
      />
    </span>
  );
}

function BuiltOnUniswapUnit() {
  return (
    <span className="live-on-ink-ticker__unit inline-flex shrink-0 items-center">
      <BuiltOnUniswapBadge variant="ticker" />
    </span>
  );
}

function TickerLayer({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`live-on-ink-ticker__layer${active ? " live-on-ink-ticker__layer--active" : ""}`}
      aria-hidden={!active}
    >
      <div className="live-on-ink-ticker__track ticker-track flex w-max items-center whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}

export function LiveOnInkTicker() {
  const [showUniswap, setShowUniswap] = useState(false);
  const segments = Array.from({ length: SEGMENT_COUNT * 2 }, (_, i) => i);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShowUniswap((current) => !current);
    }, SWITCH_MS);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="live-on-ink-ticker" aria-hidden>
      <TickerLayer active={!showUniswap}>
        {segments.map((i) => (
          <LiveOnInkUnit key={`ink-${i}`} />
        ))}
      </TickerLayer>
      <TickerLayer active={showUniswap}>
        {segments.map((i) => (
          <BuiltOnUniswapUnit key={`uni-${i}`} />
        ))}
      </TickerLayer>
    </div>
  );
}

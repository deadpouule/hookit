"use client";

import Image from "next/image";

import { PoweredByQuotronsBadge } from "@/components/brand/PoweredByQuotronsBadge";
import type { PairingTokenId } from "@/lib/pairing-tokens";

import { MultiPairGlyph } from "./CategoryGlyphs";
import { PairingLogoStack, STOCK_PAIRING_IDS } from "./PairingLogoStack";

function UsdgMark() {
  return (
    <span className="hero-typewriter-mark hero-typewriter-mark--usdg" aria-hidden>
      <Image
        src="/pairing/usdg.png"
        alt=""
        width={46}
        height={46}
        className="hero-typewriter-mark__photo h-auto w-auto"
        draggable={false}
      />
    </span>
  );
}

function EthMark() {
  return (
    <span className="hero-typewriter-mark hero-typewriter-mark--eth" aria-hidden>
      <svg viewBox="0 0 24 24" className="hero-typewriter-mark__glyph">
        <path
          fill="#fff"
          fillOpacity="0.92"
          d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
        />
      </svg>
    </span>
  );
}

function UniswapMark() {
  return (
    <span className="hero-typewriter-mark hero-typewriter-mark--uniswap" aria-hidden>
      <Image
        src="/brand/uniswap-mark.png"
        alt=""
        width={40}
        height={40}
        className="hero-typewriter-mark__photo h-auto w-auto"
        draggable={false}
      />
    </span>
  );
}

function HookitTokenMark() {
  return (
    <>
      <span className="sr-only">Hookit</span>
      <span className="hero-typewriter-mark hero-typewriter-mark--owl" aria-hidden>
        <Image
          src="/brand/hookit-owl-favicon.png"
          alt=""
          width={64}
          height={64}
          className="hero-typewriter-mark__photo h-auto w-auto"
          draggable={false}
        />
      </span>
    </>
  );
}

export function TypewriterTitle() {
  return (
    <h1 className="hero-typewriter hero-pitch">
      <span className="hero-prompt">~$</span>
      <span className="hero-pitch-lines">
        <span className="hero-pitch-line">A new way to launch</span>
        <span className="hero-pitch-line">
          Programmable v4 hooks
          <UniswapMark />
        </span>
        <span className="hero-pitch-line">
          Multi-pair pools
          <MultiPairGlyph className="hero-pitch-multi" />
          <span className="hero-pitch-marks">
            <PairingLogoStack size="sm" ids={STOCK_PAIRING_IDS as PairingTokenId[]} />
            <EthMark />
            <UsdgMark />
          </span>
        </span>
        <span className="hero-pitch-line">
          <span className="hero-pitch-hold">
            Hold
            <span className="hero-pitch-hold-token">
              <HookitTokenMark />.
            </span>
          </span>
          Collect all tokens.
        </span>
        <span className="hero-pitch-line hero-pitch-line--badge">
          <PoweredByQuotronsBadge variant="hero" className="hero-quotrons-badge" />
        </span>
      </span>
    </h1>
  );
}

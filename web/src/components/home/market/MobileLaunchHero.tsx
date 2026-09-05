"use client";

import Link from "next/link";

import { PairingLogoStack } from "./PairingLogoStack";

export function MobileLaunchHero() {
  return (
    <section className="stonk-hero md:hidden">
      <p className="stonk-hero-live">
        <span className="stonk-hero-live-dot" aria-hidden />
        Live on Ink
      </p>
      <h1 className="stonk-hero-title">Launch a token. Price it your way.</h1>
      <p className="stonk-hero-copy">Pair with stocks, USDG or ETH — programmable Uniswap v4 hooks.</p>
      <PairingLogoStack size="sm" className="stonk-hero-stack" />
      <Link href="/launch" className="stonk-hero-cta">
        Launch a token
      </Link>
    </section>
  );
}

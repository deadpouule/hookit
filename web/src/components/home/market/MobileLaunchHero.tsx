"use client";

import Link from "next/link";

import { PoweredByQuotronsBadge } from "@/components/brand/PoweredByQuotronsBadge";

import { PairingLogoStack } from "./PairingLogoStack";

export function MobileLaunchHero() {
  return (
    <section className="stonk-hero phone:block hidden">
      <h1 className="stonk-hero-title">Launch your programmable hook token. Price it your way.</h1>
      <p className="stonk-hero-copy">Pair with stocks, USDG or ETH. programmable Uniswap v4 hooks.</p>
      <div className="stonk-hero-pairings">
        <PairingLogoStack size="sm" className="stonk-hero-stack" />
        <PoweredByQuotronsBadge variant="hero" className="stonk-hero-quotrons" />
      </div>
      <Link href="/launch" className="stonk-hero-cta">
        Launch a token
      </Link>
    </section>
  );
}

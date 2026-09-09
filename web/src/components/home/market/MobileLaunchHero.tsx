"use client";

import Link from "next/link";

import { PoweredByQuotronsBadge } from "@/components/brand/PoweredByQuotronsBadge";

import { PairingLogoStack } from "./PairingLogoStack";

export function MobileLaunchHero() {
  return (
    <section className="stonk-hero phone:block hidden">
      <h1 className="stonk-hero-title">Launch your programmable hook token. Price it your way.</h1>
      <p className="stonk-hero-copy">Pair with stocks, USDG or ETH — programmable Uniswap v4 hooks.</p>
      <PairingLogoStack size="sm" className="stonk-hero-stack" />
      <PoweredByQuotronsBadge variant="compact" className="stonk-hero-quotrons" />
      <Link href="/launch" className="stonk-hero-cta">
        Launch a token
      </Link>
    </section>
  );
}

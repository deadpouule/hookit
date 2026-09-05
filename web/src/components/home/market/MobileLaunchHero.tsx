"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const PAIR_MARKS = [
  { src: "/pairing/wmstrx.png", alt: "MSTR" },
  { src: "/pairing/wtslax.png", alt: "TSLA" },
  { src: "/pairing/usdg.png", alt: "USDG" },
  { src: "/brand/uniswap-mark.png", alt: "Uniswap" },
];

export function MobileLaunchHero() {
  return (
    <section className="stonk-hero md:hidden">
      <p className="stonk-hero-live">
        <span className="stonk-hero-live-dot" aria-hidden />
        Live on Ink
      </p>
      <h1 className="stonk-hero-title">Launch a token. Price it your way.</h1>
      <p className="stonk-hero-copy">Pair with stocks, USDG or ETH — programmable Uniswap v4 hooks.</p>
      <div className="stonk-hero-marks" aria-hidden>
        {PAIR_MARKS.map((mark) => (
          <span key={mark.alt} className="stonk-hero-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark.src} alt="" width={28} height={28} />
          </span>
        ))}
      </div>
      <Link href="/launch" className="stonk-hero-cta">
        Launch a token
      </Link>
      <p className="stonk-hero-fee">
        Invite traders, earn creator fees
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </p>
    </section>
  );
}

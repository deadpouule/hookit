"use client";

import { AnimatedGridBackground } from "./AnimatedGridBackground";
import { HeroHookCarousel } from "./HeroHookCarousel";
import { TypewriterTitle } from "./TypewriterTitle";

export function LeanHero() {
  return (
    <section className="lean-hero">
      <div className="hero-banner">
        <div className="hero-copy">
          <TypewriterTitle />
        </div>
        <div className="hero-stage">
          <AnimatedGridBackground />
          <HeroHookCarousel />
        </div>
      </div>
    </section>
  );
}

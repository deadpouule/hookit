"use client";

import { AnimatedGridBackground } from "./AnimatedGridBackground";
import { HeroHookTotem } from "./HeroHookTotem";
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
          <HeroHookTotem />
        </div>
      </div>
    </section>
  );
}

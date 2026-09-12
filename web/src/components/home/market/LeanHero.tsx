"use client";

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
          <HeroHookTotem />
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

import { isPhoneDocument } from "@/lib/device";

import { HeroHookTotem } from "./HeroHookTotem";
import { TypewriterTitle } from "./TypewriterTitle";

export function LeanHero() {
  const [showTotem, setShowTotem] = useState(false);

  useEffect(() => {
    setShowTotem(!isPhoneDocument());
  }, []);

  return (
    <section className="lean-hero">
      <div className="hero-banner">
        <div className="hero-copy">
          <TypewriterTitle />
        </div>
        {showTotem ? (
          <div className="hero-stage">
            <HeroHookTotem />
          </div>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";

import { WelcomeOwl } from "@/components/brand/WelcomeOwl";
import {
  EXPLORE_HOOKS,
  hookThemeAccentColor,
  type BrowseHook,
  type BrowseHookId,
} from "@/lib/master-hooks";

const TOTEM_IDS: BrowseHookId[] = [
  "anti-snipe",
  "backed-floor",
  "holder-airdrop",
  "buyback-vesting",
  "auto-burn",
  "deepen-lps",
  "dynamic-fees",
  "anti-mev",
];

const TOTEM_HOOKS: BrowseHook[] = TOTEM_IDS.map((id) => {
  const hook = EXPLORE_HOOKS.find((item) => item.id === id);
  if (!hook) throw new Error(`missing totem hook ${id}`);
  return hook;
});

const ROTATE_MS = 2800;

export function HeroHookTotem() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(1);
  const [paused, setPaused] = useState(false);
  const active = TOTEM_HOOKS[activeIndex] ?? TOTEM_HOOKS[0];
  const accent = hookThemeAccentColor(active.theme);
  const frozen = paused || !!reduceMotion;

  useEffect(() => {
    if (frozen) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % TOTEM_HOOKS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [frozen]);

  return (
    <div
      className="hero-totem"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-totem-stage">
        <WelcomeOwl className="welcome-owl--totem" />
      </div>

      <div
        className="hero-totem-caption"
        aria-live="polite"
        style={{ "--hook-accent": accent } as CSSProperties}
      >
        <p className="hero-totem-title">{active.title}</p>
        <p className="hero-totem-copy">{active.description}</p>
      </div>
    </div>
  );
}

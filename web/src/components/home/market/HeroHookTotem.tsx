"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";

import { WelcomeOwl } from "@/components/brand/WelcomeOwl";
import { HookLogo } from "@/components/home/market/HookLogo";
import {
  EXPLORE_HOOKS,
  hookThemeAccentColor,
  type BrowseHook,
  type BrowseHookId,
} from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

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
  const [cue, setCue] = useState(false);
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

  useEffect(() => {
    if (reduceMotion) return;
    setCue(true);
    const timer = window.setTimeout(() => setCue(false), 220);
    return () => window.clearTimeout(timer);
  }, [activeIndex, reduceMotion]);

  return (
    <div
      className="hero-totem"
      style={{ "--hook-accent": accent } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-totem-stage">
        <span className="hero-totem-halo" aria-hidden />
        <WelcomeOwl className={cn("welcome-owl--totem", cue && "welcome-owl--cue")} />
      </div>

      <div className="hero-totem-dots" role="tablist" aria-label="Hooks">
        {TOTEM_HOOKS.map((hook, index) => (
          <button
            key={hook.id}
            type="button"
            role="tab"
            className={cn("hero-totem-dot", index === activeIndex && "is-on")}
            style={{ "--hook-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
            aria-label={hook.title}
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>

      <div className="hero-totem-caption" aria-live="polite">
        <p className="hero-totem-title">
          <HookLogo hookId={active.id} theme={active.theme} />
          <span>{active.title}</span>
        </p>
        <p className="hero-totem-copy">{active.description}</p>
      </div>
    </div>
  );
}

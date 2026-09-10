"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { HookLogo } from "@/components/home/market/HookLogo";
import {
  EXPLORE_HOOKS,
  launchWithHookHref,
  type BrowseHook,
} from "@/lib/master-hooks";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

const HOOKS: BrowseHook[] = EXPLORE_HOOKS;
const SLOTS = [-2, -1, 0, 1, 2] as const;
const EASE = "easeInOut" as const;
const DURATION = 0.45;
const ROTATE_MS = 2800;

function wrap(index: number, length: number) {
  return ((index % length) + length) % length;
}

function pose(offset: number) {
  const active = offset === 0;
  return {
    x: offset * 148,
    scale: active ? 1 : 0.86,
    opacity: active ? 1 : 0.42,
  };
}

function MiniHookCard({
  hook,
  offset,
  onSelect,
}: {
  hook: BrowseHook;
  offset: number;
  onSelect: () => void;
}) {
  const active = offset === 0;
  const body = (
    <>
      <h3
        className={cn(
          "orb-hook-desc-badge orb-hook-title-badge hero-hook-title-badge",
          `orb-hook-desc-badge--${hook.theme}`,
        )}
      >
        <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
        <span>{hook.title}</span>
      </h3>
      <div className="hero-hook-logo">
        <HookLogo hookId={hook.id} theme={hook.theme} />
      </div>
    </>
  );

  return (
    <motion.div
      className="hero-carousel-item"
      initial={{ ...pose(offset), opacity: 0, scale: 0.78 }}
      animate={pose(offset)}
      exit={{ opacity: 0, scale: 0.78, x: offset * 180 }}
      transition={{ duration: DURATION, ease: EASE }}
      style={{ zIndex: 10 - Math.abs(offset) }}
    >
      <div className="hero-hook-focus">
        {active ? (
          <Link
            href={launchWithHookHref(hook.id)}
            className={cn("hero-hook-card", "is-on", `hero-hook-card--${hook.theme}`)}
            aria-current="true"
          >
            {body}
          </Link>
        ) : (
          <button
            type="button"
            {...TOOLBAR_BUTTON_PROPS}
            className={cn("hero-hook-card", `hero-hook-card--${hook.theme}`)}
            onClick={onSelect}
          >
            {body}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function HeroHookCarousel() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = HOOKS.length;

  useEffect(() => {
    if (paused || reduce) return;
    const id = window.setInterval(() => {
      setActive((index) => wrap(index + 1, count));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduce, count]);

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Master hook modules"
    >
      <div className="hero-carousel-scene">
        <AnimatePresence initial={false}>
          {SLOTS.map((offset) => {
            const hook = HOOKS[wrap(active + offset, count)];
            return (
              <MiniHookCard
                key={hook.id}
                hook={hook}
                offset={offset}
                onSelect={() => setActive(wrap(active + offset, count))}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="hero-carousel-dots" role="tablist" aria-label="Hook slides">
        {HOOKS.map((hook, index) => (
          <button
            key={hook.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={hook.title}
            className={cn("hero-carousel-dot", index === active && "is-on")}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </div>
  );
}

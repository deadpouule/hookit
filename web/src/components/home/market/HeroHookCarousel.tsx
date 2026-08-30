"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import {
  MASTER_HOOKS,
  launchWithHookHref,
  type MasterHook,
} from "@/lib/master-hooks";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

const SLOTS = [-2, -1, 0, 1, 2] as const;
const EASE = "easeInOut" as const;
const DURATION = 0.5;
const ROTATE_MS = 2200;

function wrap(index: number, length: number) {
  return ((index % length) + length) % length;
}

function pose(offset: number, reduce: boolean) {
  const active = offset === 0;
  const abs = Math.abs(offset);
  const side = offset === 0 ? 0 : offset > 0 ? 1 : -1;

  if (reduce) {
    return {
      x: offset * 118,
      rotateY: 0,
      scale: active ? 1 : 0.85,
      opacity: active ? 1 : 0.4,
    };
  }

  return {
    x: offset * 108,
    rotateY: side * -42 * Math.min(abs, 2),
    scale: active ? 1 : 0.85,
    opacity: active ? 1 : 0.4,
  };
}

function MiniHookCard({
  hook,
  offset,
  reduce,
  onSelect,
}: {
  hook: MasterHook;
  offset: number;
  reduce: boolean;
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
      <div className="hero-hook-ascii">
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={active} />
      </div>
    </>
  );

  return (
    <motion.div
      className="hero-carousel-item"
      initial={{ ...pose(offset, reduce), opacity: 0, scale: 0.72, x: offset * 156 }}
      animate={pose(offset, reduce)}
      exit={{
        opacity: 0,
        scale: 0.72,
        x: offset * 156,
        rotateY: offset * -48,
      }}
      transition={{ duration: DURATION, ease: EASE }}
      style={{
        transformPerspective: 1100,
        transformOrigin: "center center",
        zIndex: 10 - Math.abs(offset),
      }}
    >
      <motion.div
        className="hero-hook-focus"
        animate={{ filter: reduce || active ? "blur(0px)" : "blur(2px)" }}
        transition={{ duration: DURATION, ease: EASE }}
      >
        {active ? (
          <Link
            href={launchWithHookHref(hook.id)}
            className={cn("hero-hook-card", "is-on")}
            aria-current="true"
          >
            {body}
          </Link>
        ) : (
          <button type="button" {...TOOLBAR_BUTTON_PROPS} className="hero-hook-card" onClick={onSelect}>
            {body}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

export function HeroHookCarousel() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = MASTER_HOOKS.length;

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
            const hook = MASTER_HOOKS[wrap(active + offset, count)];
            return (
              <MiniHookCard
                key={hook.id}
                hook={hook}
                offset={offset}
                reduce={!!reduce}
                onSelect={() => setActive(wrap(active + offset, count))}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

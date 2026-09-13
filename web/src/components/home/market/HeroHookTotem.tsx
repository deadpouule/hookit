"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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

const RING = 43;
const ROTATE_MS = 2800;

function nodePoint(index: number, count: number, radius = RING) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

type HeroHookTotemProps = {
  interactive?: boolean;
  className?: string;
  kicker?: string;
  onSelectHook?: (hook: BrowseHook) => void;
};

export function HeroHookTotem({
  interactive = true,
  className,
  kicker,
  onSelectHook,
}: HeroHookTotemProps) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [cue, setCue] = useState(false);
  const skipFirstCue = useRef(true);
  const litIndex = hoverIndex ?? activeIndex;
  const lit = TOTEM_HOOKS[litIndex] ?? TOTEM_HOOKS[0];
  const accent = hookThemeAccentColor(lit.theme);
  const frozen = !!reduceMotion || (interactive && (paused || hoverIndex !== null));

  useEffect(() => {
    if (frozen) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % TOTEM_HOOKS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [frozen]);

  useEffect(() => {
    if (reduceMotion) return;
    if (skipFirstCue.current) {
      skipFirstCue.current = false;
      return;
    }
    setCue(true);
    const timer = window.setTimeout(() => setCue(false), 220);
    return () => window.clearTimeout(timer);
  }, [activeIndex, reduceMotion]);

  return (
    <div
      className={cn("hero-totem", !interactive && "hero-totem--preview", className)}
      style={{ "--hook-accent": accent } as CSSProperties}
      onMouseEnter={interactive ? () => setPaused(true) : undefined}
      onMouseLeave={
        interactive
          ? () => {
              setPaused(false);
              setHoverIndex(null);
            }
          : undefined
      }
    >
      <div className="hero-totem-stage">
        <span className="hero-totem-halo" aria-hidden />
        <WelcomeOwl
          className={cn(
            "welcome-owl--totem",
            !interactive && "welcome-owl--preview",
            cue && "welcome-owl--cue",
          )}
        />

        {TOTEM_HOOKS.map((hook, index) => {
          const point = nodePoint(index, TOTEM_HOOKS.length);
          const markClass = cn(
            "hero-totem-mark",
            index === activeIndex && "is-on",
            index === litIndex && "is-hot",
          );
          const markStyle = {
            left: `${point.x}%`,
            top: `${point.y}%`,
            "--hook-accent": hookThemeAccentColor(hook.theme),
          } as CSSProperties;

          if (!interactive) {
            return (
              <span key={hook.id} className={markClass} style={markStyle} aria-hidden>
                <HookLogo hookId={hook.id} theme={hook.theme} />
              </span>
            );
          }

          return (
            <button
              key={hook.id}
              type="button"
              className={markClass}
              style={markStyle}
              aria-label={hook.title}
              aria-pressed={index === activeIndex}
              onMouseEnter={() => setHoverIndex(index)}
              onFocus={() => setHoverIndex(index)}
              onClick={() => {
                setActiveIndex(index);
                onSelectHook?.(hook);
              }}
            >
              <HookLogo hookId={hook.id} theme={hook.theme} />
            </button>
          );
        })}
      </div>

      {interactive ? (
        <div className="hero-totem-dots" role="tablist" aria-label="Hooks">
          {TOTEM_HOOKS.map((hook, index) => (
            <button
              key={hook.id}
              type="button"
              role="tab"
              className={cn("hero-totem-dot", index === litIndex && "is-on")}
              style={{ "--hook-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
              aria-label={hook.title}
              aria-selected={index === litIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : (
        <div className="hero-totem-dots" aria-hidden>
          {TOTEM_HOOKS.map((hook, index) => (
            <span
              key={hook.id}
              className={cn("hero-totem-dot", index === litIndex && "is-on")}
              style={{ "--hook-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
            />
          ))}
        </div>
      )}

      <div className="hero-totem-caption" aria-live={interactive ? "polite" : undefined}>
        {kicker ? <p className="hero-totem-kicker">{kicker}</p> : null}
        <p className="hero-totem-title">
          <HookLogo hookId={lit.id} theme={lit.theme} />
          <span>{lit.title}</span>
        </p>
        {interactive ? <p className="hero-totem-copy">{lit.description}</p> : null}
      </div>
    </div>
  );
}

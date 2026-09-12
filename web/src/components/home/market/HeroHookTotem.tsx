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

const RING = 42;
const ROTATE_MS = 2800;

function nodePoint(index: number, count: number, radius = RING) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

export function HeroHookTotem() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(1);
  const [hoverId, setHoverId] = useState<BrowseHookId | null>(null);
  const [rotateToken, setRotateToken] = useState(0);
  const active = TOTEM_HOOKS[activeIndex] ?? TOTEM_HOOKS[0];
  const litId = hoverId ?? active.id;
  const lit = TOTEM_HOOKS.find((hook) => hook.id === litId) ?? active;
  const accent = hookThemeAccentColor(lit.theme);
  const paused = hoverId !== null || !!reduceMotion;

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % TOTEM_HOOKS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, rotateToken]);

  return (
    <div className="hero-totem">
      <div
        className="hero-totem-stage"
        onMouseLeave={() => setHoverId(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHoverId(null);
          }
        }}
      >
        <svg className="hero-totem-rays" viewBox="0 0 100 100" aria-hidden>
          {TOTEM_HOOKS.map((hook, index) => ({ hook, index }))
            .sort((a, b) => Number(a.hook.id === litId) - Number(b.hook.id === litId))
            .map(({ hook, index }) => {
              const point = nodePoint(index, TOTEM_HOOKS.length);
              const on = hook.id === litId;
              return (
                <line
                  key={hook.id}
                  x1="50"
                  y1="50"
                  x2={point.x}
                  y2={point.y}
                  className={cn("hero-totem-ray", on && "is-on")}
                  style={{ "--hook-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
                />
              );
            })}
        </svg>

        <div className="hero-totem-core">
          <WelcomeOwl className="welcome-owl--totem" />
        </div>

        {TOTEM_HOOKS.map((hook, index) => {
          const point = nodePoint(index, TOTEM_HOOKS.length);
          const on = hook.id === active.id;
          const hot = hook.id === litId;
          return (
            <button
              key={hook.id}
              type="button"
              className={cn(
                "hero-totem-node",
                `hero-totem-node--${hook.theme}`,
                on && "is-on",
                hot && "is-hot",
              )}
              style={
                {
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  "--hook-accent": hookThemeAccentColor(hook.theme),
                } as CSSProperties
              }
              aria-pressed={on}
              aria-label={hook.title}
              onMouseEnter={() => setHoverId(hook.id)}
              onFocus={() => setHoverId(hook.id)}
              onClick={() => {
                setActiveIndex(index);
                setRotateToken((token) => token + 1);
              }}
            >
              <HookLogo hookId={hook.id} theme={hook.theme} />
            </button>
          );
        })}
      </div>

      <div
        className="hero-totem-caption"
        aria-live="polite"
        style={{ "--hook-accent": accent } as CSSProperties}
      >
        <p className="hero-totem-title">{lit.title}</p>
        <p className="hero-totem-copy">{lit.description}</p>
      </div>
    </div>
  );
}

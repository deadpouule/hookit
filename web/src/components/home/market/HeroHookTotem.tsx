"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { WelcomeOwl } from "@/components/brand/WelcomeOwl";
import { HookLogo } from "@/components/home/market/HookLogo";
import {
  EXPLORE_HOOKS,
  hookThemeAccentColor,
  launchWithHookHref,
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

const RING = 38;

function nodePoint(index: number, count: number, radius = RING) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

export function HeroHookTotem() {
  const [activeId, setActiveId] = useState<BrowseHookId>("backed-floor");
  const [hoverId, setHoverId] = useState<BrowseHookId | null>(null);
  const active = TOTEM_HOOKS.find((hook) => hook.id === activeId) ?? TOTEM_HOOKS[0];
  const litId = hoverId ?? activeId;
  const lit = TOTEM_HOOKS.find((hook) => hook.id === litId) ?? active;
  const accent = hookThemeAccentColor(lit.theme);

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
          {TOTEM_HOOKS.map((hook, index) => {
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
          const on = hook.id === activeId;
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
              onClick={() => setActiveId(hook.id)}
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
        <Link href={launchWithHookHref(lit.id)} className="hero-totem-launch">
          Launch with {lit.title}
        </Link>
      </div>
    </div>
  );
}

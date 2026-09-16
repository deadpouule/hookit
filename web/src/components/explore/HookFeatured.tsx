"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

import { HookLiveTokens } from "@/components/explore/HookLiveTokens";
import { HookLogo } from "@/components/home/market/HookLogo";
import {
  hookThemeAccentColor,
  launchWithHookHref,
  type BrowseHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";

function sentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HookFeatured({
  hook,
  livePools,
  usesPending = false,
  inCombo = false,
  onOpen,
  onToggleCombo,
}: {
  hook: BrowseHook;
  livePools: TokenPool[];
  usesPending?: boolean;
  inCombo?: boolean;
  onOpen: (hook: BrowseHook) => void;
  onToggleCombo: (hook: BrowseHook) => void;
}) {
  const accent = hookThemeAccentColor(hook.theme);

  return (
    <article
      className="hook-featured"
      style={{ "--pulse-accent": accent } as CSSProperties}
    >
      <div
        role="button"
        tabIndex={0}
        className="token-hook-pulse-card desk-card hook-pulse-browse hook-featured-card"
        data-hook-id={hook.id}
        onClick={() => onOpen(hook)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(hook);
          }
        }}
      >
        <span className="token-hook-pulse-mark" aria-hidden>
          <HookLogo hookId={hook.id} theme={hook.theme} />
        </span>
        <span className="token-hook-pulse-slide hook-featured-copy">
          <span className="hook-featured-kicker">Most used</span>
          <h2 className="token-hook-pulse-title">{hook.title}</h2>
          <p className="token-hook-pulse-desc">{sentence(hook.description)}</p>
          <span className="hook-featured-meta">
            {usesPending ? "…" : `${hook.uses} live ${hook.uses === 1 ? "use" : "uses"}`}
            <span className="hook-featured-open">Open module</span>
          </span>
        </span>
        <button
          type="button"
          className={inCombo ? "hook-combo-add is-on" : "hook-combo-add"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleCombo(hook);
          }}
        >
          {inCombo ? "In combo" : "+ Combo"}
        </button>
      </div>
      <div className="hook-featured-side">
        <p className="hook-featured-side-label">Live uses</p>
        {livePools.length > 0 ? (
          <HookLiveTokens pools={livePools} limit={10} />
        ) : (
          <p className="hook-featured-empty">No live tokens on this module yet</p>
        )}
        <Link href={launchWithHookHref(hook.id)} className="hook-featured-launch">
          Use this hook
        </Link>
      </div>
    </article>
  );
}

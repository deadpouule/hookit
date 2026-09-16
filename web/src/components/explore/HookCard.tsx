"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type KeyboardEvent } from "react";

import { HookLiveTokens } from "@/components/explore/HookLiveTokens";
import { HookLogo } from "@/components/home/market/HookLogo";
import { marketplaceHrefForHook } from "@/lib/market-hook-filter";
import {
  hookThemeAccentColor,
  type BrowseHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

function sentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HookCard({
  hook,
  usesPending = false,
  livePools = [],
  inCombo = false,
  onOpen,
  onToggleCombo,
}: {
  hook: BrowseHook;
  usesPending?: boolean;
  livePools?: TokenPool[];
  inCombo?: boolean;
  onOpen?: (hook: BrowseHook) => void;
  onToggleCombo?: (hook: BrowseHook) => void;
}) {
  const router = useRouter();
  const usesHref =
    hook.id === "fixed-fee" ? "/?category=master#tokens" : marketplaceHrefForHook(hook.id);

  const open = () => {
    if (onOpen) onOpen(hook);
    else router.push(usesHref);
  };

  const onCardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn("token-hook-pulse-card desk-card hook-pulse-browse")}
      data-hook-id={hook.id}
      style={{ "--pulse-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
      onClick={open}
      onKeyDown={onCardKey}
    >
      <span className="token-hook-pulse-mark" aria-hidden>
        <HookLogo hookId={hook.id} theme={hook.theme} />
      </span>
      <span className="token-hook-pulse-slide">
        <h2 className="token-hook-pulse-title">{hook.title}</h2>
        <p className="token-hook-pulse-desc">{sentence(hook.description)}</p>
        <span className="token-hook-pulse-link hook-pulse-uses">
          <span className="hook-pulse-uses-count">
            {usesPending ? "…" : `${hook.uses} live ${hook.uses === 1 ? "use" : "uses"}`}
          </span>
          <HookLiveTokens pools={livePools} />
        </span>
      </span>
      {onToggleCombo ? (
        <button
          type="button"
          className={cn("hook-combo-add", inCombo && "is-on")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleCombo(hook);
          }}
        >
          {inCombo ? "In combo" : "+ Combo"}
        </button>
      ) : null}
    </div>
  );
}

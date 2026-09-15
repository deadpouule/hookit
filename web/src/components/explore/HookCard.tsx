"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties } from "react";

import { HookLogo } from "@/components/home/market/HookLogo";
import { marketplaceHrefForHook } from "@/lib/market-hook-filter";
import {
  hookThemeAccentColor,
  type BrowseHook,
} from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

function sentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HookCard({
  hook,
  usesPending = false,
  onOpen,
}: {
  hook: BrowseHook;
  usesPending?: boolean;
  onOpen?: (hook: BrowseHook) => void;
}) {
  const router = useRouter();
  const usesHref =
    hook.id === "fixed-fee" ? "/?category=master#tokens" : marketplaceHrefForHook(hook.id);

  return (
    <button
      type="button"
      className={cn("token-hook-pulse-card desk-card hook-pulse-browse")}
      style={{ "--pulse-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
      onClick={() => {
        if (onOpen) onOpen(hook);
        else router.push(usesHref);
      }}
    >
      <span className="token-hook-pulse-slide">
        <span className="token-hook-pulse-mark" aria-hidden>
            <HookLogo hookId={hook.id} theme={hook.theme} />
        </span>
        <h2 className="token-hook-pulse-title">{hook.title}</h2>
        <p className="token-hook-pulse-desc">{sentence(hook.description)}</p>
        <span className="token-hook-pulse-link">
          {usesPending ? "…" : `${hook.uses} live ${hook.uses === 1 ? "use" : "uses"}`}
        </span>
      </span>
    </button>
  );
}

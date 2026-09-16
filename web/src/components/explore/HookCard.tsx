"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties } from "react";

import { HookLogo } from "@/components/home/market/HookLogo";
import { marketplaceHrefForHook } from "@/lib/market-hook-filter";
import {
  hookThemeAccentColor,
  type BrowseHook,
  type MasterHookCategory,
} from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<MasterHookCategory, string> = {
  protection: "Protection",
  tokenomics: "Tokenomics",
  rewards: "Rewards",
  "trading-fees": "Fees",
};

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
      className={cn("hook-browse-card")}
      data-hook-id={hook.id}
      style={{ "--pulse-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
      onClick={() => {
        window.setTimeout(() => {
          if (onOpen) onOpen(hook);
          else router.push(usesHref);
        }, 0);
      }}
    >
      <span className="hook-browse-card__top">
        <span className="hook-browse-card__logo" aria-hidden>
          <HookLogo hookId={hook.id} theme={hook.theme} />
        </span>
        <span className="hook-browse-card__chips">
          <span className="hook-browse-card__cat">{CATEGORY_LABEL[hook.category]}</span>
          <span className="hook-browse-card__uses">
            {usesPending ? "…" : `${hook.uses} live ${hook.uses === 1 ? "use" : "uses"}`}
          </span>
        </span>
      </span>
      <span className="hook-browse-card__body">
        <h2 className="hook-browse-card__title">{hook.title}</h2>
        <p className="hook-browse-card__desc">{sentence(hook.description)}</p>
      </span>
      <span className="hook-browse-card__cta">Open module</span>
    </button>
  );
}

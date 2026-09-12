"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { HookLogo } from "@/components/home/market/HookLogo";
import { marketplaceHrefForHook } from "@/lib/market-hook-filter";
import {
  launchWithHookHref,
  type BrowseHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

function capitalizeDescription(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function HookCard({ hook, pools }: { hook: BrowseHook; pools: TokenPool[] }) {
  const router = useRouter();

  return (
    <motion.article
        className={cn("orb-card", `orb-card--${hook.theme}`)}
        onClick={() => router.push(launchWithHookHref(hook.id))}
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="orb-card-head">
          <h2
            className={cn(
              "orb-hook-desc-badge orb-hook-title-badge",
              `orb-hook-desc-badge--${hook.theme}`,
            )}
          >
            <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
            <span>{hook.title}</span>
          </h2>
          <HookSettingsTooltip hook={hook} />
        </div>

        <div className="orb-stage my-2">
          <div className="hook-arcade-screen">
            <HookLogo hookId={hook.id} theme={hook.theme} className="hook-logo--stage" />
          </div>
        </div>

        <div className="orb-footer">
          <p className="orb-hook-blurb">{capitalizeDescription(hook.description)}</p>

          <div className="orb-footer-actions">
            <a
              href={hook.id === "fixed-fee" ? "/?category=master#tokens" : marketplaceHrefForHook(hook.id)}
              className="orb-use-badge"
              onClick={(event) => event.stopPropagation()}
            >
              {hook.uses} live {hook.uses === 1 ? "use" : "uses"}
            </a>
            <a
              href={launchWithHookHref(hook.id)}
              className="orb-use-badge"
              onClick={(event) => event.stopPropagation()}
            >
              Use this hook
            </a>
          </div>
        </div>
      </motion.article>
  );
}

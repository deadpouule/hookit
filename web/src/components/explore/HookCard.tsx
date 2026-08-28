"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { marketplaceHrefForHook } from "@/lib/market-hook-filter";
import {
  launchWithHookHref,
  type MasterHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

function capitalizeDescription(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function HookCard({ hook, pools }: { hook: MasterHook; pools: TokenPool[] }) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
        className={cn("orb-card", `orb-card--${hook.theme}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={isHovered} />
        </div>

        <div className="orb-footer">
          <span className={cn("orb-hook-desc-badge", `orb-hook-desc-badge--${hook.theme}`)}>
            <MasterHookGlyph className="orb-hook-desc-badge-glyph" />
            <span>{capitalizeDescription(hook.description)}</span>
          </span>

          <div className="orb-footer-actions">
            <button
              type="button"
              className="orb-use-badge"
              onClick={(event) => {
                event.stopPropagation();
                router.push(marketplaceHrefForHook(hook.id));
              }}
            >
              {hook.uses} live {hook.uses === 1 ? "use" : "uses"}
            </button>
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

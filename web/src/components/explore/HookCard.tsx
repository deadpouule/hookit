"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { HookSettingsTooltip } from "@/components/explore/HookSettingsTooltip";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { launchWithHookHref, type MasterHook } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

function capitalizeDescription(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function HookCard({ hook }: { hook: MasterHook }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.a
      href={launchWithHookHref(hook.id)}
      className={cn("orb-card", `orb-card--${hook.theme}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="orb-card-head">
        <h2>{hook.title}</h2>
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
          <span className="font-mono text-[10px] text-zinc-500">
            {hook.uses} live {hook.uses === 1 ? "use" : "uses"}
          </span>
          <span className={cn("orb-hook-desc-badge orb-use-badge", `orb-hook-desc-badge--${hook.theme}`)}>
            Use this hook
          </span>
        </div>
      </div>
    </motion.a>
  );
}

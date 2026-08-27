"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { launchWithHookHref, type MasterHook } from "@/lib/master-hooks";

export function HookCard({ hook }: { hook: MasterHook }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.a
      href={launchWithHookHref(hook.id)}
      className="orb-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <h2>{hook.title}</h2>

      <div className="orb-stage my-2">
        <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={isHovered} />
      </div>

      <div className="orb-footer">
        <p className="text-xs font-bold text-white">{hook.description}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-zinc-500">
            {hook.uses} live {hook.uses === 1 ? "use" : "uses"}
          </span>
          <span className="orb-use">Use this hook</span>
        </div>
      </div>
    </motion.a>
  );
}

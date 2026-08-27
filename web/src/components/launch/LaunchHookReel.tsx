"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AsciiShape } from "@/components/explore/AsciiShape";
import { MASTER_HOOKS } from "@/lib/master-hooks";

const SLOTS = [-2, -1, 0, 1, 2] as const;
const EASE = "easeInOut" as const;
const DURATION = 0.5;
const ROTATE_MS = 2200;

function wrap(index: number, length: number) {
  return ((index % length) + length) % length;
}

function pose(offset: number, reduce: boolean) {
  const active = offset === 0;
  const abs = Math.abs(offset);
  const side = offset === 0 ? 0 : offset > 0 ? 1 : -1;

  if (reduce) {
    return {
      x: offset * 72,
      rotateY: 0,
      scale: active ? 1 : 0.85,
      opacity: active ? 1 : 0.4,
    };
  }

  return {
    x: offset * 64,
    rotateY: side * -38 * Math.min(abs, 2),
    scale: active ? 1 : 0.85,
    opacity: active ? 1 : 0.4,
  };
}

export function LaunchHookReel() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const count = MASTER_HOOKS.length;

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setActive((index) => wrap(index + 1, count));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduce, count]);

  return (
    <div className="launch-reel" aria-hidden>
      <div className="launch-reel-scene">
        <AnimatePresence initial={false}>
          {SLOTS.map((offset) => {
            const hook = MASTER_HOOKS[wrap(active + offset, count)];
            const isOn = offset === 0;
            return (
              <motion.div
                key={hook.id}
                className="launch-reel-item"
                initial={{ ...pose(offset, !!reduce), opacity: 0, scale: 0.7 }}
                animate={pose(offset, !!reduce)}
                exit={{ opacity: 0, scale: 0.7, x: offset * 96 }}
                transition={{ duration: DURATION, ease: EASE }}
                style={{
                  transformPerspective: 900,
                  transformOrigin: "center center",
                  zIndex: 10 - Math.abs(offset),
                }}
              >
                <motion.div
                  className={isOn ? "launch-reel-card is-on" : "launch-reel-card"}
                  animate={{ filter: reduce || isOn ? "blur(0px)" : "blur(1.5px)" }}
                  transition={{ duration: DURATION, ease: EASE }}
                >
                  <p>{hook.title}</p>
                  <div className="launch-reel-ascii">
                    <AsciiShape hookId={hook.id} theme={hook.theme} isHovered={isOn} />
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

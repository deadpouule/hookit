"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export function AnimatedGridBackground({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn("hero-grid", className)}
      aria-hidden
      animate={reduce ? undefined : { backgroundPositionY: ["0px", "40px"] }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
    />
  );
}

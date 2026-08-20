"use client";

import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChromeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function ChromeButton({ children, className, loading, disabled, ...props }: ChromeButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.99 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl p-[1px] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/40 via-base-blue to-neon-lime/60 opacity-80 transition group-hover:opacity-100 group-hover:shadow-[0_0_40px_rgba(0,82,255,0.4)]" />
      <button
        type="button"
        disabled={disabled || loading}
        className="relative flex w-full items-center justify-center gap-2 rounded-[15px] bg-zinc-900 px-6 py-4 text-base font-semibold text-white transition group-hover:bg-zinc-900/90 disabled:cursor-not-allowed disabled:opacity-60"
        {...props}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Zap className="h-5 w-5 text-neon-lime" />
        )}
        {children}
      </button>
    </motion.div>
  );
}

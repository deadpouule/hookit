"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "border border-white/10 bg-[#111111]! text-zinc-100! shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
          title: "text-sm font-medium",
          description: "text-xs text-zinc-400",
          success: "border-emerald-500/30!",
          error: "border-red-500/30!",
        },
      }}
    />
  );
}

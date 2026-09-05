"use client";

import { Toaster } from "sonner";
import { useSyncExternalStore } from "react";

function subscribeMq(cb: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMobile() {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function AppToaster() {
  const mobile = useSyncExternalStore(subscribeMq, getMobile, () => false);

  return (
    <Toaster
      theme="dark"
      position={mobile ? "top-center" : "bottom-right"}
      offset={mobile ? 16 : 24}
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

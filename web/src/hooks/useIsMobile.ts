"use client";

import { useSyncExternalStore } from "react";

function subscribe(breakpointPx: number, cb: () => void) {
  const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Matches Tailwind `md` (768px). SSR defaults to desktop to avoid layout flash. */
export function useIsMobile(breakpointPx = 768) {
  return useSyncExternalStore(
    (cb) => subscribe(breakpointPx, cb),
    () => window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches,
    () => false,
  );
}

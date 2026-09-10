"use client";

import { useEffect, useState } from "react";

/** Unix seconds, ticking once per second while `enabled`. */
export function useNowSeconds(enabled: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!enabled) return;
    setNow(Math.floor(Date.now() / 1000));
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return now;
}

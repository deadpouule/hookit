"use client";

import { useEffect, useState } from "react";

import { buildInitialLive, LIVE_TICK_MS, tickLive, type LiveTokenState } from "@/lib/token-live";
import type { TokenPool } from "@/lib/types";

export function useLiveToken(pool: TokenPool) {
  const [live, setLive] = useState<LiveTokenState>(() => buildInitialLive(pool));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLive((prev) => tickLive(prev));
    }, LIVE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [pool.id]);

  return live;
}

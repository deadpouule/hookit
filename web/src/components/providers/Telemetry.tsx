"use client";

import { Analytics } from "@vercel/analytics/react";
import { useEffect } from "react";

import { initSentry } from "@/lib/sentry";

/** Client analytics + optional Sentry (no-op without DSN). */
export function Telemetry() {
  useEffect(() => {
    initSentry();
  }, []);

  return <Analytics />;
}

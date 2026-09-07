"use client";

import { useSyncExternalStore } from "react";

import { isPhoneDocument } from "@/lib/device";

function subscribe(cb: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(cb);
  obs.observe(el, { attributes: true, attributeFilter: ["data-device"] });
  return () => obs.disconnect();
}

/** Phone handsets only. Desktop windows stay desktop even when the tab is narrow. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, isPhoneDocument, () => false);
}

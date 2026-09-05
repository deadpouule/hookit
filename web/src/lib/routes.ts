export function tokenHref(id: string) {
  return `/token/${id}`;
}

export const LAUNCH_HREF = "/launch";
export const EXPLORE_HREF = "/";

const LAST_SWAP_KEY = "hookit:last-swap-href";

/** Remember last token desk for the mobile Swap tab. */
export function rememberSwapHref(href: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAST_SWAP_KEY, href);
  } catch {
    /* private mode */
  }
}

export function getLastSwapHref(): string {
  if (typeof window === "undefined") return LAUNCH_HREF;
  try {
    const stored = window.sessionStorage.getItem(LAST_SWAP_KEY);
    if (stored?.startsWith("/token/")) return stored;
  } catch {
    /* private mode */
  }
  return LAUNCH_HREF;
}

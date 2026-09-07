/** True for phones only — not tablets, not a resized desktop window. */
export function isPhoneUserAgent(ua: string): boolean {
  if (!ua) return false;
  if (/iPad|Tablet|PlayBook|Nexus 7|Silk/i.test(ua)) return false;
  return /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile.*Firefox/i.test(
    ua,
  );
}

export function isPhoneRequest(headerList: Headers): boolean {
  const hint = headerList.get("sec-ch-ua-mobile");
  if (hint === "?1") return true;
  if (hint === "?0") return false;
  return isPhoneUserAgent(headerList.get("user-agent") ?? "");
}

export function isPhoneDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.device === "phone";
}

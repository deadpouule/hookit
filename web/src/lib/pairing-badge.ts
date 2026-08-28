import { isRwaQuote } from "@/lib/token-identity";

/** CSS modifier for colored pairing curve badges (e.g. waaplx curve). */
export type PairingBadgeTone =
  | "eth"
  | "usdg"
  | "waaplx"
  | "wamznx"
  | "wgooglx"
  | "wmstrx"
  | "wnflxx"
  | "wnvdax"
  | "wspyx"
  | "wtslax"
  | "stock";

export function normalizeQuoteKey(quoteAsset?: string): string {
  if (!quoteAsset) return "eth";
  return quoteAsset.trim().toLowerCase();
}

/** Label like "waaplx curve" for RWA / stock pairings; null for plain ETH master pools. */
export function pairingCurveBadge(
  quoteAsset?: string,
  quoteAddress?: string,
): { label: string; tone: PairingBadgeTone } | null {
  const key = normalizeQuoteKey(quoteAsset);

  if (key === "eth" || key === "weth") return null;

  if (key === "usdg" || key === "usdc") {
    return { label: "usdg curve", tone: "usdg" };
  }

  if (isRwaQuote(quoteAsset, quoteAddress) || (key.startsWith("w") && key.endsWith("x"))) {
    const tone = PAIRING_TONE[key as PairingBadgeTone] ? (key as PairingBadgeTone) : "stock";
    return { label: `${key} curve`, tone };
  }

  if (quoteAsset) {
    return { label: `${key} curve`, tone: "stock" };
  }

  return null;
}

const PAIRING_TONE: Partial<Record<PairingBadgeTone, true>> = {
  waaplx: true,
  wamznx: true,
  wgooglx: true,
  wmstrx: true,
  wnflxx: true,
  wnvdax: true,
  wspyx: true,
  wtslax: true,
};

export function pairingBadgeClassName(tone: PairingBadgeTone): string {
  return `token-type-badge token-type-badge--pair-${tone}`;
}

import { pairingById, PAIRING_TOKENS, type PairingTokenId } from "@/lib/pairing-tokens";
import { isRwaQuote } from "@/lib/token-identity";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

/** CSS modifier for colored pairing badges (e.g. NVIDIA). */
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

export type PairingBadgeInfo = {
  name: string;
  tone: PairingBadgeTone;
  pairingId: PairingTokenId;
};

export function normalizeQuoteKey(quoteAsset?: string): string {
  if (!quoteAsset) return "eth";
  return quoteAsset.trim().toLowerCase();
}

function resolvePairingId(quoteAsset?: string, quoteAddress?: string): PairingTokenId | null {
  const key = normalizeQuoteKey(quoteAsset);

  if (key === "eth" || key === "weth") return null;
  if (key === "usdg" || key === "usdc") return "usdg";

  if (PAIRING_TONE[key as PairingBadgeTone]) return key as PairingTokenId;

  if (quoteAddress) {
    const stock = INK_QUOTRON_STOCKS.find(
      (listing) => listing.address.toLowerCase() === quoteAddress.toLowerCase(),
    );
    if (stock) return stock.symbol.toLowerCase() as PairingTokenId;
  }

  if (key.startsWith("w") && key.endsWith("x")) return key as PairingTokenId;

  return null;
}

function pairingDisplayName(id: PairingTokenId | string): string {
  const token = PAIRING_TOKENS.find((entry) => entry.id === id);
  if (token) return token.name;

  const stock = INK_QUOTRON_STOCKS.find((listing) => listing.symbol.toLowerCase() === id.toLowerCase());
  if (stock) return stock.name;

  return pairingById(id).name;
}

/** Badge info for RWA / stock pairings; null for plain ETH master pools. */
export function pairingCurveBadge(
  quoteAsset?: string,
  quoteAddress?: string,
): PairingBadgeInfo | null {
  const key = normalizeQuoteKey(quoteAsset);

  if (key === "eth" || key === "weth") return null;

  if (key === "usdg" || key === "usdc") {
    return { name: pairingDisplayName("usdg"), tone: "usdg", pairingId: "usdg" };
  }

  if (isRwaQuote(quoteAsset, quoteAddress) || (key.startsWith("w") && key.endsWith("x"))) {
    const pairingId = resolvePairingId(quoteAsset, quoteAddress) ?? (key as PairingTokenId);
    const tone = PAIRING_TONE[key as PairingBadgeTone] ? (key as PairingBadgeTone) : "stock";
    return { name: pairingDisplayName(pairingId), tone, pairingId };
  }

  if (quoteAsset) {
    const pairingId = resolvePairingId(quoteAsset, quoteAddress) ?? (key as PairingTokenId);
    return { name: pairingDisplayName(pairingId), tone: "stock", pairingId };
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

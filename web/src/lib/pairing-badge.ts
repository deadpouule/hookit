import { pairingById, PAIRING_TOKENS, type PairingTokenId } from "@/lib/pairing-tokens";
import { STABLE_QUOTE_ADDRESS, USDG_INK_ADDRESS } from "@/lib/contracts/config";
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

/** Resolve a pairing badge from an on-chain quote token address. */
export function pairingBadgeFromQuoteAddress(quoteAddress?: string): PairingBadgeInfo | null {
  if (!quoteAddress) return null;
  const addr = quoteAddress.toLowerCase();
  if (addr === "0x0000000000000000000000000000000000000000") {
    return { name: "Ether", tone: "eth", pairingId: "eth" };
  }
  if (
    addr === STABLE_QUOTE_ADDRESS.toLowerCase() ||
    addr === USDG_INK_ADDRESS.toLowerCase()
  ) {
    return { name: pairingDisplayName("usdg"), tone: "usdg", pairingId: "usdg" };
  }

  const stock = INK_QUOTRON_STOCKS.find((listing) => listing.address.toLowerCase() === addr);
  if (stock) {
    const pairingId = stock.symbol.toLowerCase() as PairingTokenId;
    const tone = PAIRING_TONE[pairingId as PairingBadgeTone]
      ? (pairingId as PairingBadgeTone)
      : "stock";
    return { name: stock.name, tone, pairingId };
  }

  return null;
}

export function pairingBadgesForPool(pool: {
  quoteAsset?: string;
  quoteAddress?: string;
  markets?: { quoteAddress: `0x${string}`; quoteAsset?: string }[];
  marketCount?: number;
}): PairingBadgeInfo[] {
  const seen = new Set<PairingTokenId>();
  const out: PairingBadgeInfo[] = [];

  const push = (badge: PairingBadgeInfo | null) => {
    if (!badge || seen.has(badge.pairingId)) return;
    seen.add(badge.pairingId);
    out.push(badge);
  };

  if (pool.markets?.length) {
    for (const market of pool.markets) {
      push(pairingBadgeFromQuoteAddress(market.quoteAddress));
    }
  }

  if (out.length === 0) {
    push(pairingCurveBadge(pool.quoteAsset, pool.quoteAddress));
  }

  return out;
}

export function isMultiPairPool(pool: {
  marketCount?: number;
  markets?: unknown[];
}): boolean {
  if (pool.marketCount != null && pool.marketCount > 1) return true;
  return (pool.markets?.length ?? 0) > 1;
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

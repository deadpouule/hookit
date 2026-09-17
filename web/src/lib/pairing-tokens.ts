export type PairingTokenId =
  | "eth"
  | "usdg"
  | "waaplx"
  | "wamznx"
  | "wgooglx"
  | "wmcdx"
  | "wmstrx"
  | "wnflxx"
  | "wnvdax"
  | "wspyx"
  | "wtslax";

export interface PairingToken {
  id: PairingTokenId;
  ticker: string;
  name: string;
  subtitle: string;
  classic?: boolean;
  /** Greyed out in the launch picker; cannot be selected. */
  disabled?: boolean;
}

export const PAIRING_TOKENS: PairingToken[] = [
  { id: "eth", ticker: "ETH", name: "Ether", subtitle: "the classic pair", classic: true },
  { id: "usdg", ticker: "USDG", name: "Global Dollar", subtitle: "priced in USDG" },
  { id: "waaplx", ticker: "wAAPLx", name: "Apple", subtitle: "priced in wAAPLx" },
  { id: "wamznx", ticker: "wAMZNx", name: "Amazon", subtitle: "priced in wAMZNx" },
  { id: "wgooglx", ticker: "wGOOGLx", name: "Alphabet", subtitle: "priced in wGOOGLx" },
  { id: "wmcdx", ticker: "wMCDx", name: "McDonald's", subtitle: "priced in wMCDx" },
  { id: "wmstrx", ticker: "wMSTRx", name: "MicroStrategy", subtitle: "priced in wMSTRx" },
  { id: "wnflxx", ticker: "wNFLXx", name: "Netflix", subtitle: "unavailable", disabled: true },
  { id: "wnvdax", ticker: "wNVDAx", name: "NVIDIA", subtitle: "priced in wNVDAx" },
  { id: "wspyx", ticker: "wSPYx", name: "S&P 500", subtitle: "priced in wSPYx" },
  { id: "wtslax", ticker: "wTSLAx", name: "Tesla", subtitle: "priced in wTSLAx" },
];

export function pairingById(id: string) {
  return PAIRING_TOKENS.find((token) => token.id === id) ?? PAIRING_TOKENS[0];
}

export function isPairingDisabled(id: string): boolean {
  return PAIRING_TOKENS.some((token) => token.id === id && token.disabled);
}

/** Native ETH is single-pair only. Multi-pair is USDG + Quotrons wStocks. */
export function isMultiPairQuote(id: PairingTokenId): boolean {
  return id !== "eth";
}

export function multiPairingTokens(): PairingToken[] {
  return PAIRING_TOKENS.filter((token) => isMultiPairQuote(token.id));
}

export function firstEnabledPairing(exclude?: PairingTokenId): PairingToken | undefined {
  return PAIRING_TOKENS.find((token) => !token.disabled && token.id !== exclude);
}

export function firstEnabledMultiPairing(exclude?: PairingTokenId): PairingToken | undefined {
  return PAIRING_TOKENS.find(
    (token) => !token.disabled && isMultiPairQuote(token.id) && token.id !== exclude,
  );
}

export function formatPairingTicker(id: PairingTokenId) {
  return pairingById(id).ticker;
}

export function pairingSubtitle(id: PairingTokenId) {
  if (id === "eth") return "the classic pair";
  return `priced in ${formatPairingTicker(id)}`;
}

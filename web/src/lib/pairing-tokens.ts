export type PairingTokenId =
  | "eth"
  | "usdg"
  | "waaplx"
  | "wamznx"
  | "wgooglx"
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
}

export const PAIRING_TOKENS: PairingToken[] = [
  { id: "eth", ticker: "ETH", name: "Ether", subtitle: "the classic pair", classic: true },
  { id: "usdg", ticker: "USDG", name: "Global Dollar", subtitle: "priced in USDG" },
  { id: "waaplx", ticker: "wAAPLx", name: "Apple", subtitle: "priced in wAAPLx" },
  { id: "wamznx", ticker: "wAMZNx", name: "Amazon", subtitle: "priced in wAMZNx" },
  { id: "wgooglx", ticker: "wGOOGLx", name: "Alphabet", subtitle: "priced in wGOOGLx" },
  { id: "wmstrx", ticker: "wMSTRx", name: "MicroStrategy", subtitle: "priced in wMSTRx" },
  { id: "wnflxx", ticker: "wNFLXx", name: "Netflix", subtitle: "priced in wNFLXx" },
  { id: "wnvdax", ticker: "wNVDAx", name: "NVIDIA", subtitle: "priced in wNVDAx" },
  { id: "wspyx", ticker: "wSPYx", name: "S&P 500", subtitle: "priced in wSPYx" },
  { id: "wtslax", ticker: "wTSLAx", name: "Tesla", subtitle: "priced in wTSLAx" },
];

export function pairingById(id: string) {
  return PAIRING_TOKENS.find((token) => token.id === id) ?? PAIRING_TOKENS[0];
}

export function formatPairingTicker(id: PairingTokenId) {
  if (id === "eth") return "ETH";
  if (id === "usdg") return "USDG";
  return `w${id.slice(1, -1).toUpperCase()}x`;
}

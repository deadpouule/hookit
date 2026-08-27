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
  { id: "eth", ticker: "eth", name: "Ether", subtitle: "the classic pair", classic: true },
  { id: "usdg", ticker: "usdg", name: "Global Dollar", subtitle: "priced in usdg" },
  { id: "waaplx", ticker: "waaplx", name: "Apple", subtitle: "priced in waaplx" },
  { id: "wamznx", ticker: "wamznx", name: "Amazon", subtitle: "priced in wamznx" },
  { id: "wgooglx", ticker: "wgooglx", name: "Alphabet", subtitle: "priced in wgooglx" },
  { id: "wmstrx", ticker: "wmstrx", name: "MicroStrategy", subtitle: "priced in wmstrx" },
  { id: "wnflxx", ticker: "wnflxx", name: "Netflix", subtitle: "priced in wnflxx" },
  { id: "wnvdax", ticker: "wnvdax", name: "NVIDIA", subtitle: "priced in wnvdax" },
  { id: "wspyx", ticker: "wspyx", name: "S&P 500", subtitle: "priced in wspyx" },
  { id: "wtslax", ticker: "wtslax", name: "Tesla", subtitle: "priced in wtslax" },
];

export function pairingById(id: string) {
  return PAIRING_TOKENS.find((token) => token.id === id) ?? PAIRING_TOKENS[0];
}

export function formatPairingTicker(id: PairingTokenId) {
  if (id === "eth") return "ETH";
  if (id === "usdg") return "USDG";
  return `w${id.slice(1, -1).toUpperCase()}x`;
}

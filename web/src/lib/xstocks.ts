import type { Address } from "viem";

/** Quotrons wrapped equities on Ink — https://quotrons.cash/integration/xstocks-manifest.json */
export type QuotronStockListing = {
  symbol: string;
  name: string;
  address: Address;
  decimals: 18;
  /** Underlying xStocks API symbol for USD price refresh (e.g. AAPLx for wAAPLx). */
  priceSymbol: string;
  quotronPoolId: `0x${string}`;
  /** Fallback USD when API + Quotrons pool are unavailable (matches on-chain seed). */
  fallbackUsd: number;
};

export const INK_QUOTRON_STOCKS: QuotronStockListing[] = [
  {
    symbol: "wAAPLx",
    name: "Apple",
    address: "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f",
    decimals: 18,
    priceSymbol: "AAPLx",
    quotronPoolId: "0x0ef0fe35389f4104afef27864010022976ed1b924e8837b30f308255d07d3092",
    fallbackUsd: 309.775,
  },
  {
    symbol: "wAMZNx",
    name: "Amazon",
    address: "0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90",
    decimals: 18,
    priceSymbol: "AMZNx",
    quotronPoolId: "0xc113916ee057276dfd79b4ff4a29be5e98703e410923e4a61e95ccf459223a38",
    fallbackUsd: 263.75,
  },
  {
    symbol: "wGOOGLx",
    name: "Alphabet",
    address: "0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f",
    decimals: 18,
    priceSymbol: "GOOGLx",
    quotronPoolId: "0x5ec6f9fc8178f8b3a9c09b56d073a4503a5ea3f127ece3e8a8d1579c0cf9c3b2",
    fallbackUsd: 349.4,
  },
  {
    symbol: "wMSTRx",
    name: "Strategy",
    address: "0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB",
    decimals: 18,
    priceSymbol: "MSTRx",
    quotronPoolId: "0xb7add80f794d65c978346f9e929971d2f12b4f862c89f4c14201872819a39a7d",
    fallbackUsd: 121.57,
  },
  {
    symbol: "wNFLXx",
    name: "Netflix",
    address: "0x7d87fD6A379714194a797c0bBB8B40c30D250856",
    decimals: 18,
    priceSymbol: "NFLXx",
    quotronPoolId: "0x9f11034d6b2a7bfea38a0c39548c590e4aabd215ffa2b6bbe9bacd29e40238b6",
    fallbackUsd: 819.4,
  },
  {
    symbol: "wNVDAx",
    name: "NVIDIA",
    address: "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5",
    decimals: 18,
    priceSymbol: "NVDAx",
    quotronPoolId: "0xebe5d3cc94d87cf07cf06c969ca82a67760697535c57800350e210df8547cd11",
    fallbackUsd: 211.32,
  },
  {
    symbol: "wSPYx",
    name: "S&P 500 ETF",
    address: "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540",
    decimals: 18,
    priceSymbol: "SPYx",
    quotronPoolId: "0x84b421dc355c6c003fcf4f8100691eddaa0319deb894acb7e9bbf633621694a7",
    fallbackUsd: 767.582,
  },
  {
    symbol: "wTSLAx",
    name: "Tesla",
    address: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
    decimals: 18,
    priceSymbol: "TSLAx",
    quotronPoolId: "0x131ebb0eb148451d7225a52e94a8257b69976e780ebce1615aadf47d8e2aaf19",
    fallbackUsd: 351.9,
  },
];

export const QUOTRONS_HOOK = "0x8bb4516059F9149Bc3b89018Fc7537f1F14a30cc" as Address;
export const QUOTRONS_DYNAMIC_FEE = 0x800000;
export const XSTOCKS_API = "https://api.xstocks.fi/api/v2";
export const XSTOCKS_LOGO_BASE = "https://xstocks-metadata.backed.fi/logos/tokens";

/** Local pairing assets override incorrect remote xStocks logos. */
const LOCAL_QUOTRON_LOGOS: Partial<Record<QuotronStockListing["priceSymbol"], string>> = {
  NVDAx: "/pairing/wnvdax.png",
  SPYx: "/pairing/wspyx.png",
  MSTRx: "/pairing/wmstrx.png",
  NFLXx: "/pairing/wnflxx.png",
  TSLAx: "/pairing/wtslax.png",
};

export function quotronStockLogoUrl(listing: Pick<QuotronStockListing, "priceSymbol">): string {
  const local = LOCAL_QUOTRON_LOGOS[listing.priceSymbol];
  if (local) return local;
  return `${XSTOCKS_LOGO_BASE}/${listing.priceSymbol}.png`;
}

/** @deprecated use INK_QUOTRON_STOCKS */
export const INK_XSTOCKS = INK_QUOTRON_STOCKS;

export async function fetchXStockUsdPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${XSTOCKS_API}/public/assets/${symbol}/price-data?network=Ink`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { quote?: number };
    return typeof body.quote === "number" && body.quote > 0 ? body.quote : null;
  } catch {
    return null;
  }
}

export async function fetchQuotronStockUsdPrice(listing: QuotronStockListing): Promise<number | null> {
  return fetchXStockUsdPrice(listing.priceSymbol);
}

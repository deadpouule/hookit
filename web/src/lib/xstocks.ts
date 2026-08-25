import type { Address } from "viem";

/** Curated xStocks on Ink mainnet — see https://docs.xstocks.fi/docs */
export type XStockListing = {
  symbol: string;
  name: string;
  address: Address;
  decimals: 18;
};

export const INK_XSTOCKS: XStockListing[] = [
  { symbol: "AAPLx", name: "Apple xStock", address: "0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a", decimals: 18 },
  { symbol: "NVDAx", name: "NVIDIA xStock", address: "0xc845b2894dBddd03858fd2D643B4eF725fE0849d", decimals: 18 },
  { symbol: "TSLAx", name: "Tesla xStock", address: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0", decimals: 18 },
  { symbol: "MSFTx", name: "Microsoft xStock", address: "0x5621737f42dAE558b81269FcB9E9E70c19Aa6b35", decimals: 18 },
  { symbol: "GOOGLx", name: "Alphabet xStock", address: "0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F", decimals: 18 },
  { symbol: "AMZNx", name: "Amazon xStock", address: "0x3557Ba345B01EFa20A1bdDC61F573BFD87195081", decimals: 18 },
  { symbol: "METAx", name: "Meta xStock", address: "0x96702be57Cd9777f835117a809C7124fe4ec989A", decimals: 18 },
  { symbol: "COINx", name: "Coinbase xStock", address: "0x364f210f430eC2448Fc68A49203040F6124096F0", decimals: 18 },
  { symbol: "MSTRx", name: "MicroStrategy xStock", address: "0xAE2f842EF90C0d5213259Ab82639D5BBF649b08E", decimals: 18 },
  { symbol: "SPYx", name: "SPDR S&P 500 ETF xStock", address: "0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48", decimals: 18 },
  { symbol: "QQQx", name: "Invesco QQQ ETF xStock", address: "0xa753A7395cAe905Cd615Da0B82A53E0560f250af", decimals: 18 },
];

export const XSTOCKS_API = "https://api.xstocks.fi/api/v2";

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

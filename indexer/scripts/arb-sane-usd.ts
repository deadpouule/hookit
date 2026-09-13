/**
 * Rank multi-pair markets with a sane wStock USD (ignore blown Quotrons ticks).
 */
import {
  type Address,
  createPublicClient,
  encodeAbiParameters,
  keccak256,
  parseAbi,
} from "viem";

import { fallbackStockUsd, isEthQuote, quoteLabel, type V4PoolKey } from "./arb-usdg";

const STATE_VIEW_INK = "0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990" as Address;
const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;
const TOTAL_SUPPLY = 1_000_000_000;

export const USD_SANITY_MAX_RATIO = 2.5;

export function isSaneUsd(candidate: number, reference: number, maxRatio = USD_SANITY_MAX_RATIO): boolean {
  if (!(candidate > 0) || !(reference > 0)) return false;
  const ratio = candidate / reference;
  return ratio <= maxRatio && ratio >= 1 / maxRatio;
}

/** Prefer listing seed when factory/live Quotrons USD is an extreme-tick outlier. */
export function saneStockUsd(factoryOrLiveUsd: number, fallbackUsd: number): number {
  if (fallbackUsd > 0 && isSaneUsd(factoryOrLiveUsd, fallbackUsd)) return factoryOrLiveUsd;
  if (fallbackUsd > 0) return fallbackUsd;
  return factoryOrLiveUsd > 0 ? factoryOrLiveUsd : 0;
}

export function quoteFromTokenWei(
  tokenAmount: bigint,
  sqrtPriceX96: bigint,
  tokenIsCurrency0: boolean,
): bigint {
  if (tokenAmount === 0n || sqrtPriceX96 === 0n) return 0n;
  if (tokenIsCurrency0) {
    const step = (tokenAmount * sqrtPriceX96) / Q96;
    return (step * sqrtPriceX96) / Q96;
  }
  return (tokenAmount * Q192) / (sqrtPriceX96 * sqrtPriceX96);
}

export function poolIdFromKey(key: V4PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
          ],
        },
      ],
      [key],
    ),
  );
}

export type RankedMarket = {
  index: number;
  quote: Address;
  fdvUsd: number;
  factoryUsd: number;
  saneUsd: number;
};

export type SanePreview = {
  cheapIndex: number;
  richIndex: number;
  cheapQuote: Address;
  richQuote: Address;
  cheapFdvUsd: number;
  richFdvUsd: number;
  deviationBps: number;
  matchesOnChain: boolean;
  usdgBuySane: boolean;
  markets: RankedMarket[];
};

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

export async function rankLaunchMarkets(
  publicClient: ReturnType<typeof createPublicClient>,
  opts: {
    token: Address;
    quotes: Address[];
    poolKeys: V4PoolKey[];
    factoryUsdByQuote: Map<string, number>;
    onChainCheapIndex: number;
    onChainRichIndex: number;
  },
): Promise<SanePreview | null> {
  const { token, quotes, poolKeys, factoryUsdByQuote, onChainCheapIndex, onChainRichIndex } = opts;
  if (quotes.length < 2) return null;

  const markets: RankedMarket[] = [];
  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i]!;
    const key = poolKeys[i]!;
    const tokenIs0 = key.currency0.toLowerCase() === token.toLowerCase();
    let sqrt = 0n;
    try {
      const slot = await publicClient.readContract({
        address: STATE_VIEW_INK,
        abi: stateViewAbi,
        functionName: "getSlot0",
        args: [poolIdFromKey(key)],
      });
      sqrt = (slot as readonly [bigint])[0];
    } catch (err) {
      console.error(`[arb-sane] getSlot0 failed market ${i} ${quoteLabel(quote)}`, err);
      continue;
    }
    const quoteWei = quoteFromTokenWei(10n ** 18n, sqrt, tokenIs0);
    const quoteHuman = Number(quoteWei) / 1e18;
    const factoryUsd = factoryUsdByQuote.get(quote.toLowerCase()) ?? 0;
    const fallback = isEthQuote(quote) ? 0 : fallbackStockUsd(quote);
    const usd = saneStockUsd(factoryUsd, fallback);
    const fdvUsd = quoteHuman * TOTAL_SUPPLY * usd;
    markets.push({ index: i, quote, fdvUsd, factoryUsd, saneUsd: usd });
  }

  if (markets.length < 2) return null;

  let cheap = markets[0]!;
  let rich = markets[0]!;
  for (const m of markets) {
    if (m.fdvUsd > 0 && (cheap.fdvUsd === 0 || m.fdvUsd < cheap.fdvUsd)) cheap = m;
    if (m.fdvUsd >= rich.fdvUsd) rich = m;
  }
  if (cheap.fdvUsd <= 0 || cheap.index === rich.index) return null;

  const deviationBps = Math.floor(((rich.fdvUsd - cheap.fdvUsd) / cheap.fdvUsd) * 10_000);
  const usdgBuySane = isSaneUsd(cheap.factoryUsd, fallbackStockUsd(cheap.quote) || cheap.saneUsd);

  console.log(
    `[arb-sane] cheap=${quoteLabel(cheap.quote)} (idx ${cheap.index}) fdv=$${cheap.fdvUsd.toFixed(0)}` +
      ` rich=${quoteLabel(rich.quote)} (idx ${rich.index}) fdv=$${rich.fdvUsd.toFixed(0)}` +
      ` devBps=${deviationBps} usdgBuySane=${usdgBuySane}` +
      ` onChain cheap=${onChainCheapIndex} rich=${onChainRichIndex}`,
  );

  return {
    cheapIndex: cheap.index,
    richIndex: rich.index,
    cheapQuote: cheap.quote,
    richQuote: rich.quote,
    cheapFdvUsd: cheap.fdvUsd,
    richFdvUsd: rich.fdvUsd,
    deviationBps,
    matchesOnChain: cheap.index === onChainCheapIndex && rich.index === onChainRichIndex,
    usdgBuySane,
    markets,
  };
}

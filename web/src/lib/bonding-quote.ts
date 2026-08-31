import { BASE_FEE_BPS } from "@/lib/constants";
import type { BondingLaunchRow } from "@/lib/launches";

const BPS = 10_000n;

function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / BPS;
}

function splitFee(amount: bigint): { fee: bigint; net: bigint } {
  const fee = applyBps(amount, BASE_FEE_BPS);
  return { fee, net: amount - fee };
}

/** Mirrors BondingMath.buyQuoteIn */
function buyQuoteIn(virtualQuote: bigint, virtualToken: bigint, quoteIn: bigint): bigint {
  if (quoteIn <= 0n || virtualQuote <= 0n || virtualToken <= 0n) return 0n;
  const newVirtualQuote = virtualQuote + quoteIn;
  const k = virtualQuote * virtualToken;
  const newVirtualToken = k / newVirtualQuote;
  if (newVirtualToken >= virtualToken) return 0n;
  return virtualToken - newVirtualToken;
}

/** Mirrors BondingMath.sellTokenIn */
function sellTokenIn(virtualQuote: bigint, virtualToken: bigint, tokensIn: bigint): bigint {
  if (tokensIn <= 0n || virtualQuote <= 0n || virtualToken <= 0n) return 0n;
  const newVirtualToken = virtualToken + tokensIn;
  const k = virtualQuote * virtualToken;
  const newVirtualQuote = k / newVirtualToken;
  if (newVirtualQuote >= virtualQuote) return 0n;
  return virtualQuote - newVirtualQuote;
}

/** Mirrors BondingMath.quoteInForTokensOut (ceil division). */
function quoteInForTokensOut(
  virtualQuote: bigint,
  virtualToken: bigint,
  tokensOut: bigint,
): bigint {
  if (tokensOut <= 0n || virtualQuote <= 0n || virtualToken <= 0n || tokensOut >= virtualToken) {
    return 0n;
  }
  const newVirtualToken = virtualToken - tokensOut;
  const k = virtualQuote * virtualToken;
  const newVirtualQuote = (k + newVirtualToken - 1n) / newVirtualToken;
  if (newVirtualQuote <= virtualQuote) return 0n;
  return newVirtualQuote - virtualQuote;
}

export type BondingQuoteResult = {
  amountOut: bigint;
  minAmountOut: bigint;
  priceImpactPct: number;
  route: string;
};

export function quoteBondingBuy(
  launch: Pick<
    BondingLaunchRow,
    "virtualQuote" | "virtualToken" | "curveSupply" | "tokensSold" | "realQuote"
  >,
  quoteInGross: bigint,
  slippagePct: number,
): BondingQuoteResult | null {
  if (quoteInGross <= 0n) return null;

  const available = launch.curveSupply - launch.tokensSold;
  if (available <= 0n) return null;

  const { net: quoteForCurve } = splitFee(quoteInGross);
  if (quoteForCurve <= 0n) return null;

  let tokensOut = buyQuoteIn(launch.virtualQuote, launch.virtualToken, quoteForCurve);

  if (tokensOut > available) {
    const quoteNeeded = quoteInForTokensOut(
      launch.virtualQuote,
      launch.virtualToken,
      available,
    );
    if (quoteNeeded <= 0n) return null;
    tokensOut = available;
    const spotBefore =
      Number(launch.virtualQuote) / Number(launch.virtualToken || 1n);
    const execPrice = Number(quoteNeeded) / Number(tokensOut);
    const impact =
      spotBefore > 0 ? Math.max(0, ((execPrice - spotBefore) / spotBefore) * 100) : 0;
    const minOut = applySlippage(tokensOut, slippagePct);
    return {
      amountOut: tokensOut,
      minAmountOut: minOut,
      priceImpactPct: impact,
      route: "Bonding curve",
    };
  }

  if (tokensOut <= 0n) return null;

  const spotBefore = Number(launch.virtualQuote) / Number(launch.virtualToken || 1n);
  const execPrice = Number(quoteForCurve) / Number(tokensOut);
  const impact =
    spotBefore > 0 ? Math.max(0, ((execPrice - spotBefore) / spotBefore) * 100) : 0;

  return {
    amountOut: tokensOut,
    minAmountOut: applySlippage(tokensOut, slippagePct),
    priceImpactPct: impact,
    route: "Bonding curve",
  };
}

export function quoteBondingSell(
  launch: Pick<BondingLaunchRow, "virtualQuote" | "virtualToken" | "realQuote">,
  tokensIn: bigint,
  slippagePct: number,
): BondingQuoteResult | null {
  if (tokensIn <= 0n) return null;

  let quoteOut = sellTokenIn(launch.virtualQuote, launch.virtualToken, tokensIn);
  if (quoteOut > launch.realQuote) quoteOut = launch.realQuote;
  if (quoteOut <= 0n) return null;

  const { net: netOut } = splitFee(quoteOut);
  if (netOut <= 0n) return null;

  const spotBefore = Number(launch.virtualQuote) / Number(launch.virtualToken || 1n);
  const execPrice = Number(netOut) / Number(tokensIn);
  const impact =
    spotBefore > 0 ? Math.max(0, ((spotBefore - execPrice) / spotBefore) * 100) : 0;

  return {
    amountOut: netOut,
    minAmountOut: applySlippage(netOut, slippagePct),
    priceImpactPct: impact,
    route: "Bonding curve",
  };
}

function applySlippage(amount: bigint, slippagePct: number): bigint {
  const bps = Math.min(5_000, Math.max(0, Math.round(slippagePct * 100)));
  return (amount * BigInt(10_000 - bps)) / BPS;
}

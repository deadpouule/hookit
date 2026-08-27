/** Spot quote per 1 whole token (18 decimals) from Uniswap v4 sqrtPriceX96. */
export function quotePerToken(sqrtPriceX96: bigint, tokenIsCurrency0: boolean): string {
  if (sqrtPriceX96 === 0n) return "0";
  const Q96 = 2n ** 96n;
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  const ratio = Number(priceX192) / Number(Q96 * Q96);
  if (ratio <= 0) return "0";
  const spot = tokenIsCurrency0 ? ratio : 1 / ratio;
  return spot.toString();
}

/** Quote per whole token from raw wei amounts (bonding curve trades). */
export function quotePerTokenFromAmounts(
  quoteAmount: bigint,
  tokenAmount: bigint,
  tokenDecimals = 18,
  quoteDecimals = 18,
): string {
  if (tokenAmount === 0n) return "0";
  const q = Number(quoteAmount) / 10 ** quoteDecimals;
  const t = Number(tokenAmount) / 10 ** tokenDecimals;
  if (t <= 0) return "0";
  return (q / t).toString();
}

export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

export function compareDec(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (na === nb) return 0;
  return na > nb ? 1 : -1;
}

export function maxDec(a: string, b: string): string {
  return compareDec(a, b) >= 0 ? a : b;
}

export function minDec(a: string, b: string): string {
  return compareDec(a, b) <= 0 ? a : b;
}

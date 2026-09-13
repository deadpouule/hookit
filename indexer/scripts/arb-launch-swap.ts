/**
 * Launch-pool swaps for arb keeper — recycle rich-leg wStock when Quotrons bridge is tick-bound.
 */
import {
  type Address,
  type Hash,
  createPublicClient,
  createWalletClient,
  parseAbi,
} from "viem";

import {
  poolQuoteAddress,
  quoteLabel,
  readErc20Balance,
  type V4PoolKey,
} from "./arb-usdg";

const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;

function sqrtPriceLimit(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n;
}

export function hookSwapDirection(poolKey: V4PoolKey, token: Address, side: "buy" | "sell"): boolean {
  const tokenIs0 = token.toLowerCase() === poolKey.currency0.toLowerCase();
  return side === "buy" ? !tokenIs0 : tokenIs0;
}

const routerAbi = parseAbi([
  "function swapExactIn((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, uint160 sqrtPriceLimitX96) returns (uint256 amountOut)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

async function approveIfNeeded(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  token: Address,
  spender: Address,
  amount: bigint,
  account: Address,
) {
  const allowance = await publicClient.readContract({
    address: token,
    abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
    functionName: "allowance",
    args: [account, spender],
  });
  if (allowance >= amount) return;
  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Spend launch quote (wStock) → receive launch token. */
export async function swapQuoteForTokenOnLaunch(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  poolKey: V4PoolKey,
  token: Address,
  quoteIn: bigint,
  account: Address,
): Promise<bigint> {
  if (quoteIn === 0n) return 0n;
  const quote = poolQuoteAddress(poolKey, token);
  const zeroForOne = hookSwapDirection(poolKey, token, "buy");
  await approveIfNeeded(walletClient, publicClient, quote, router, quoteIn, account);
  const tokenBefore = await readErc20Balance(publicClient, token, account);
  const hash = (await walletClient.writeContract({
    address: router,
    abi: routerAbi,
    functionName: "swapExactIn",
    args: [poolKey, zeroForOne, quoteIn, 1n, sqrtPriceLimit(zeroForOne)],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
  const tokenAfter = await readErc20Balance(publicClient, token, account);
  return tokenAfter > tokenBefore ? tokenAfter - tokenBefore : 0n;
}

/** Spend launch token → receive launch quote (wStock). */
export async function swapTokenForQuoteOnLaunch(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  poolKey: V4PoolKey,
  token: Address,
  tokenIn: bigint,
  account: Address,
): Promise<bigint> {
  if (tokenIn === 0n) return 0n;
  const quote = poolQuoteAddress(poolKey, token);
  const zeroForOne = hookSwapDirection(poolKey, token, "sell");
  await approveIfNeeded(walletClient, publicClient, token, router, tokenIn, account);
  const quoteBefore = await readErc20Balance(publicClient, quote, account);
  const hash = (await walletClient.writeContract({
    address: router,
    abi: routerAbi,
    functionName: "swapExactIn",
    args: [poolKey, zeroForOne, tokenIn, 1n, sqrtPriceLimit(zeroForOne)],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
  const quoteAfter = await readErc20Balance(publicClient, quote, account);
  return quoteAfter > quoteBefore ? quoteAfter - quoteBefore : 0n;
}

/** Rich-leg wStock → launch token → cheap-leg wStock (when Quotrons stock→USDG is blocked). */
export async function convertLaunchQuoteToCheapQuote(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  opts: {
    token: Address;
    fromQuote: Address;
    fromPoolKey: V4PoolKey;
    cheapQuote: Address;
    cheapPoolKey: V4PoolKey;
    amountIn: bigint;
    account: Address;
  },
): Promise<bigint> {
  const { token, fromQuote, fromPoolKey, cheapQuote, cheapPoolKey, amountIn, account } = opts;
  if (amountIn === 0n) return 0n;
  console.log(
    `[arb-launch] ${quoteLabel(fromQuote)} → token → ${quoteLabel(cheapQuote)} (${amountIn} wei in)`,
  );
  const tokens = await swapQuoteForTokenOnLaunch(
    publicClient,
    walletClient,
    router,
    fromPoolKey,
    token,
    amountIn,
    account,
  );
  if (tokens === 0n) return 0n;
  const cheapOut = await swapTokenForQuoteOnLaunch(
    publicClient,
    walletClient,
    router,
    cheapPoolKey,
    token,
    tokens,
    account,
  );
  console.log(`[arb-launch] converted ${quoteLabel(fromQuote)} → ${cheapOut} wei ${quoteLabel(cheapQuote)}`);
  return cheapOut;
}

/** Buy launch token on the cheap pool, sell on the rich pool (bypasses executor oracle). */
export async function executeLaunchArb(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  opts: {
    token: Address;
    cheapQuote: Address;
    cheapPoolKey: V4PoolKey;
    richQuote: Address;
    richPoolKey: V4PoolKey;
    cheapAmountIn: bigint;
    account: Address;
  },
): Promise<{ tokenSold: bigint; quoteOut: bigint }> {
  const { token, cheapQuote, cheapPoolKey, richQuote, richPoolKey, cheapAmountIn, account } = opts;
  if (cheapAmountIn > 0n) {
    const bought = await swapQuoteForTokenOnLaunch(
      publicClient,
      walletClient,
      router,
      cheapPoolKey,
      token,
      cheapAmountIn,
      account,
    );
    console.log(`[arb-launch] bought ${bought} token with ${cheapAmountIn} wei ${quoteLabel(cheapQuote)}`);
  }
  const tokenBal = await readErc20Balance(publicClient, token, account);
  if (tokenBal === 0n) return { tokenSold: 0n, quoteOut: 0n };
  const quoteOut = await swapTokenForQuoteOnLaunch(
    publicClient,
    walletClient,
    router,
    richPoolKey,
    token,
    tokenBal,
    account,
  );
  console.log(
    `[arb-launch] sold ${tokenBal} token → ${quoteOut} wei ${quoteLabel(richQuote)}`,
  );
  return { tokenSold: tokenBal, quoteOut };
}

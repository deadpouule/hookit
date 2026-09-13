/**
 * USDG ↔ Quotrons wStock helpers for arb keeper prefund / sweep.
 */
import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
} from "viem";

export const USDG_INK = "0xe343167631d89B6Ffc58B88d6b7fB0228795491D" as Address;
export const QUOTRONS_HOOK = "0x8bb4516059F9149Bc3b89018Fc7537f1F14a30cc" as Address;
export const QUOTRONS_DYNAMIC_FEE = 0x800000;
export const QUOTRONS_TICK_SPACING = 60;

/** Matches QuotronStockQuotes.listings() on Ink. */
export const QUOTRON_STOCKS: Address[] = [
  "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f",
  "0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90",
  "0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f",
  "0xc6639026a3a862cd4fcbae3f67cB2D25A2959d37",
  "0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB",
  "0x7d87fD6A379714194a797c0bBB8B40c30D250856",
  "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5",
  "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540",
  "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
].map((a) => a as Address);

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const routerAbi = parseAbi([
  "function swapExactIn((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, uint160 sqrtPriceLimitX96) returns (uint256 amountOut)",
]);

const executorWithdrawAbi = parseAbi([
  "function owner() view returns (address)",
  "function withdraw(address currency, address to, uint256 amount)",
]);

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export function isQuotronStock(addr: Address): boolean {
  return QUOTRON_STOCKS.some((s) => s.toLowerCase() === addr.toLowerCase());
}

export function quotronBridgePoolKey(stock: Address): V4PoolKey {
  const usdg = USDG_INK;
  const stockLower = stock.toLowerCase();
  const usdgLower = usdg.toLowerCase();
  const [c0, c1] =
    BigInt(stockLower) < BigInt(usdgLower) ? [stock, usdg] : [usdg, stock];
  return {
    currency0: c0,
    currency1: c1,
    fee: QUOTRONS_DYNAMIC_FEE,
    tickSpacing: QUOTRONS_TICK_SPACING,
    hooks: QUOTRONS_HOOK,
  };
}

/** True when swapping `tokenIn` for the other leg is zeroForOne on the Quotrons pool. */
export function quotronZeroForOne(stock: Address, tokenIn: Address): boolean {
  const key = quotronBridgePoolKey(stock);
  return tokenIn.toLowerCase() === key.currency0.toLowerCase();
}

export function poolQuoteAddress(poolKey: V4PoolKey, token: Address): Address {
  if (poolKey.currency0.toLowerCase() === token.toLowerCase()) return poolKey.currency1;
  if (poolKey.currency1.toLowerCase() === token.toLowerCase()) return poolKey.currency0;
  throw new Error(`token ${token} not in pool ${poolKey.currency0}/${poolKey.currency1}`);
}

export async function readErc20Balance(
  publicClient: ReturnType<typeof createPublicClient>,
  token: Address,
  account: Address,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

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

/** Keeper wallet: USDG → wStock on Quotrons bridge pool. */
export async function swapUsdgForStock(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  stock: Address,
  usdgIn: bigint,
  account: Address,
): Promise<bigint> {
  if (usdgIn === 0n) return 0n;
  const key = quotronBridgePoolKey(stock);
  const zeroForOne = quotronZeroForOne(stock, USDG_INK);
  await approveIfNeeded(walletClient, publicClient, USDG_INK, router, usdgIn, account);
  const stockBefore = await readErc20Balance(publicClient, stock, account);
  const hash = (await walletClient.writeContract({
    address: router,
    abi: routerAbi,
    functionName: "swapExactIn",
    args: [key, zeroForOne, usdgIn, 1n, 0n],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
  const stockAfter = await readErc20Balance(publicClient, stock, account);
  return stockAfter > stockBefore ? stockAfter - stockBefore : 0n;
}

/** Keeper wallet: wStock → USDG on Quotrons bridge pool. */
export async function swapStockForUsdg(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  stock: Address,
  stockIn: bigint,
  account: Address,
): Promise<bigint> {
  if (stockIn === 0n) return 0n;
  const key = quotronBridgePoolKey(stock);
  const zeroForOne = quotronZeroForOne(stock, stock);
  await approveIfNeeded(walletClient, publicClient, stock, router, stockIn, account);
  const usdgBefore = await readErc20Balance(publicClient, USDG_INK, account);
  const hash = (await walletClient.writeContract({
    address: router,
    abi: routerAbi,
    functionName: "swapExactIn",
    args: [key, zeroForOne, stockIn, 1n, 0n],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
  const usdgAfter = await readErc20Balance(publicClient, USDG_INK, account);
  return usdgAfter > usdgBefore ? usdgAfter - usdgBefore : 0n;
}

export async function transferErc20(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  token: Address,
  to: Address,
  amount: bigint,
): Promise<void> {
  if (amount === 0n) return;
  const hash = (await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
}

/** Pull ERC-20 from executor to keeper when keeper is contract owner. */
export async function withdrawExecutorErc20(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  executor: Address,
  token: Address,
  to: Address,
  amount: bigint,
  account: Address,
): Promise<boolean> {
  if (amount === 0n) return false;
  const owner = (await publicClient.readContract({
    address: executor,
    abi: executorWithdrawAbi,
    functionName: "owner",
  })) as Address;
  if (owner.toLowerCase() !== account.toLowerCase()) {
    console.log(`[arb-keeper] skip withdraw ${token}: keeper is not executor owner`);
    return false;
  }
  const hash = (await walletClient.writeContract({
    address: executor,
    abi: executorWithdrawAbi,
    functionName: "withdraw",
    args: [token, to, amount],
  })) as Hash;
  await publicClient.waitForTransactionReceipt({ hash });
  return true;
}

export function usdgAddr(): Address {
  const raw = process.env.USDG_ADDRESS?.trim() ?? process.env.USDC_ADDRESS?.trim();
  if (raw && isAddress(raw)) return raw as Address;
  return USDG_INK;
}

export function routerAddr(): Address | null {
  const raw =
    process.env.HOOKIT_SWAP_ROUTER?.trim() ??
    process.env.MULTI_PAIR_ARB_ROUTER?.trim() ??
    process.env.NEXT_PUBLIC_HOOKIT_SWAP_ROUTER?.trim();
  if (raw && isAddress(raw)) return raw as Address;
  return null;
}

/** USDG (6 dec) to spend on cheap-leg prefund — default min(keeper USDG, max clip USD). */
export function prefundUsdgBudget(keeperUsdg: bigint, maxClipUsdX18: bigint): bigint {
  const env = process.env.MULTI_PAIR_ARB_PREFUND_USDG_AMOUNT?.trim();
  if (env) return BigInt(env);
  const clipUsdg = maxClipUsdX18 / 10n ** 12n; // 50e18 USD → 50e6 USDG wei
  const reserve = BigInt(process.env.MULTI_PAIR_ARB_USDG_RESERVE ?? "500000"); // 0.5 USDG
  const spendable = keeperUsdg > reserve ? keeperUsdg - reserve : 0n;
  return spendable < clipUsdg ? spendable : clipUsdg;
}

export function isEthQuote(addr: Address): boolean {
  return addr.toLowerCase() === ZERO.toLowerCase();
}

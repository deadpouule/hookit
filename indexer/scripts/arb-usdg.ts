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

/** Uniswap v4 TickMath bounds — limit 0 reverts with PriceLimitAlreadyExceeded. */
const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;

function sqrtPriceLimit(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n;
}

async function quotronSqrtPrice(
  publicClient: ReturnType<typeof createPublicClient>,
  stock: Address,
): Promise<bigint | null> {
  const poolId = QUOTRON_POOL_BY_STOCK.get(stock.toLowerCase());
  if (!poolId) return null;
  try {
    const slot = await publicClient.readContract({
      address: STATE_VIEW_INK,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [poolId],
    });
    return (slot as readonly [bigint])[0];
  } catch {
    return null;
  }
}

/** Stock→USDG reverts when the Quotrons pool is already at the v4 min/max tick. */
export async function canSwapStockToUsdg(
  publicClient: ReturnType<typeof createPublicClient>,
  stock: Address,
): Promise<boolean> {
  const sqrt = await quotronSqrtPrice(publicClient, stock);
  if (sqrt == null) return true;
  const zeroForOne = quotronZeroForOne(stock, stock);
  if (zeroForOne && sqrt <= MIN_SQRT_PRICE + 1n) return false;
  if (!zeroForOne && sqrt >= MAX_SQRT_PRICE - 1n) return false;
  return true;
}

export type SweepOptions = {
  executor?: Address;
  /** Leave these quote tokens on the executor (cheap-leg prefund inventory). */
  keepOnExecutor?: Address[];
};

const STATE_VIEW_INK = "0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990" as Address;

/** wStock address (lower) → Quotrons wStock/USDG pool id. */
const QUOTRON_POOL_BY_STOCK = new Map<string, Hex>([
  [
    "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f",
    "0x0ef0fe35389f4104afef27864010022976ed1b924e8837b30f308255d07d3092",
  ],
  [
    "0x910cabde3eba7fc1ce64fd14bd680b9f60fa0f90",
    "0xc113916ee057276dfd79b4ff4a29be5e98703e410923e4a61e95ccf459223a38",
  ],
  [
    "0xf8c5308f80e459bb53d9ebe689854d9cbb2caa6f",
    "0x5ec6f9fc8178f8b3a9c09b56d073a4503a5ea3f127ece3e8a8d1579c0cf9c3b2",
  ],
  [
    "0xc6639026a3a862cd4fcbae3f67cb2d25a2959d37",
    "0x020595993f159c9865966f8762ebdba88c2cf465bb4af72b512eb3559f430254",
  ],
  [
    "0x30987adf0b11dc698438a99ba04ec3a1ab2c7eab",
    "0xb7add80f794d65c978346f9e929971d2f12b4f862c89f4c14201872819a39a7d",
  ],
  [
    "0x7d87fd6a379714194a797c0bbb8b40c30d250856",
    "0x9f11034d6b2a7bfea38a0c39548c590e4aabd215ffa2b6bbe9bacd29e40238b6",
  ],
  [
    "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    "0xebe5d3cc94d87cf07cf06c969ca82a67760697535c57800350e210df8547cd11",
  ],
  [
    "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    "0x84b421dc355c6c003fcf4f8100691eddaa0319deb894acb7e9bbf633621694a7",
  ],
  [
    "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171",
    "0x131ebb0eb148451d7225a52e94a8257b69976e780ebce1615aadf47d8e2aaf19",
  ],
]);

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 id) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

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
    args: [key, zeroForOne, usdgIn, 1n, sqrtPriceLimit(zeroForOne)],
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
    args: [key, zeroForOne, stockIn, 1n, sqrtPriceLimit(zeroForOne)],
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
    console.log(`[arb-usdg] skip withdraw ${token}: keeper is not executor owner`);
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

/**
 * Pull wStock from executor (if any), swap all keeper wStock → USDG on Quotrons.
 * Arb output lands on the rich leg (often a different wStock than prefund) — always
 * recycle to USDG so the keeper can prefund the next cheap leg.
 */
function keepOnExecutor(stock: Address, keep?: Address[]): boolean {
  if (!keep?.length) return false;
  const key = stock.toLowerCase();
  return keep.some((a) => a.toLowerCase() === key);
}

export async function sweepStocksToUsdg(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  router: Address,
  keeper: Address,
  options?: SweepOptions,
): Promise<void> {
  const executor = options?.executor;
  const keep = options?.keepOnExecutor;

  for (const stock of QUOTRON_STOCKS) {
    if (executor && !keepOnExecutor(stock, keep)) {
      const execBal = await readErc20Balance(publicClient, stock, executor);
      if (execBal > 0n) {
        const pulled = await withdrawExecutorErc20(
          publicClient,
          walletClient,
          executor,
          stock,
          keeper,
          execBal,
          keeper,
        );
        if (!pulled) {
          console.log(`[arb-usdg] could not withdraw ${stock} from executor — skip swap`);
          continue;
        }
      }
    }

    const keeperBal = await readErc20Balance(publicClient, stock, keeper);
    if (keeperBal === 0n) continue;

    if (!(await canSwapStockToUsdg(publicClient, stock))) {
      console.log(
        `[arb-usdg] skip sweep ${stock} (${keeperBal} wei): Quotrons pool at tick bound`,
      );
      continue;
    }

    try {
      const usdgOut = await swapStockForUsdg(
        publicClient,
        walletClient,
        router,
        stock,
        keeperBal,
        keeper,
      );
      console.log(`[arb-usdg] sweep ${stock} → ${usdgOut} USDG wei (keeper)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[arb-usdg] sweep ${stock} failed (${keeperBal} wei): ${msg.split("\n")[0]}`);
    }
  }
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

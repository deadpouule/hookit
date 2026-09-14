/**
 * Multi-pair price arb keeper (Ink).
 *
 * Buys the launch token on the cheapest USD market and sells on the richest via
 * MultiPairArbExecutor. Auto-scans launchMulti (2+ markets). Prefunds the executor
 * from keeper USDG via Quotrons bridge pools when the cheap leg is a wStock.
 *
 * Run (from indexer dir):
 *   npm run arb-keeper
 *
 * Env:
 *   MULTI_PAIR_ARB=false                 master switch (default off)
 *   MULTI_PAIR_ARB_DRY_RUN=true          preview only (default true when enabled)
 *   MULTI_PAIR_ARB_EXECUTOR              executor address (required when enabled)
 *   MULTI_PAIR_ARB_LAUNCH_IDS            optional comma filter (default: auto-scan)
 *   MULTI_PAIR_ARB_AUTO=true             auto-discover launchMulti ids
 *   MULTI_PAIR_ARB_PREFUND_USDG=true     prefund executor (keeper wStock transfer, else USDG→wStock)
 *   MULTI_PAIR_ARB_KEEPER_STOCK_DUST=1000000000000000  wei left on keeper when transferring wStock
 *   MULTI_PAIR_ARB_SWEEP_USDG=true       recycle executor/keeper wStock → USDG (default on)
 *   HOOKIT_SWAP_ROUTER                   HookitSwapRouter (required for USDG prefund)
 *   LAUNCH_FACTORY                       factory to scan (default: executor.factory())
 *   FEE_KEEPER_PRIVATE_KEY / PRIVATE_KEY keeper wallet (operator + ideally owner)
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
import { privateKeyToAccount } from "viem/accounts";

import { convertLaunchQuoteToCheapQuote, executeLaunchArb } from "./arb-launch-swap";
import { previewFromMarkets, rankLaunchMarkets } from "./arb-sane-usd";
import {
  canSwapUsdgForStock,
  isEthQuote,
  isQuotronStock,
  logKeeperUsdgBalance,
  nonCheapLaunchStocks,
  poolQuoteAddress,
  quoteLabel,
  readErc20Balance,
  routerAddr,
  sweepStocksToUsdg,
  swapUsdgForStock,
  transferErc20,
  usdgAddr,
  withdrawExecutorErc20,
  type V4PoolKey,
} from "./arb-usdg";
import { resolveInkRpcUrl } from "./rpc-env";

const INK = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"] } },
} as const;

type ArbPreview = {
  marketCount: number;
  cheapIndex: number;
  richIndex: number;
  cheapUsdX18: bigint;
  richUsdX18: bigint;
  deviationBps: number;
  clipQuoteWei: bigint;
  executable: boolean;
};

const executorAbi = parseAbi([
  "function paused() view returns (bool)",
  "function maxClipUsdX18() view returns (uint256)",
  "function minDeviationBps() view returns (uint16)",
  "function hook() view returns (address)",
  "function factory() view returns (address)",
  "function preview(uint256 launchId) view returns ((uint8 marketCount, uint8 cheapIndex, uint8 richIndex, uint256 cheapUsdX18, uint256 richUsdX18, uint256 deviationBps, uint256 clipQuoteWei, bool executable))",
  "function execute(uint256 launchId) returns (uint256 clipQuoteWei, uint256 tokenSold, uint256 quoteOut)",
]);

const hookAbi = parseAbi([
  "function arbActive() view returns (bool)",
  "function arbExecutor() view returns (address)",
]);

const launchFactoryAbi = parseAbi([
  "function launchCount() view returns (uint256)",
  "function launchMarketCount(uint256 launchId) view returns (uint8)",
  "function launches(uint256 launchId) view returns (address token, address creator, address hooks, bool customHook, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity)",
  "function poolKeyOfMarket(uint256 launchId, uint256 marketIndex) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))",
  "function quoteUsdPriceX18(address quote) view returns (uint256)",
  "function quoteConfigs(address quote) view returns (bool, uint8, uint256, uint256)",
]);

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function envAddr(name: string): Address | null {
  const v = process.env[name]?.trim();
  if (v && isAddress(v)) return v as Address;
  return null;
}

function envLaunchIds(): bigint[] | null {
  const raw = process.env.MULTI_PAIR_ARB_LAUNCH_IDS?.trim() ?? "";
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s));
}

function factoryFromEnv(): Address | null {
  const v = process.env.LAUNCH_FACTORY?.split(",")[0]?.trim();
  if (v && isAddress(v)) return v as Address;
  return null;
}

function pk(required: boolean): Hex {
  const raw = (process.env.FEE_KEEPER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  if (!raw) {
    if (required) throw new Error("Set FEE_KEEPER_PRIVATE_KEY (or PRIVATE_KEY) for the arb keeper wallet");
    return `0x${"00".repeat(31)}01` as Hex;
  }
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

function parsePreview(raw: unknown): ArbPreview {
  if (Array.isArray(raw)) {
    return {
      marketCount: Number(raw[0]),
      cheapIndex: Number(raw[1]),
      richIndex: Number(raw[2]),
      cheapUsdX18: raw[3] as bigint,
      richUsdX18: raw[4] as bigint,
      deviationBps: Number(raw[5]),
      clipQuoteWei: raw[6] as bigint,
      executable: Boolean(raw[7]),
    };
  }
  const p = raw as ArbPreview;
  return {
    marketCount: Number(p.marketCount),
    cheapIndex: Number(p.cheapIndex),
    richIndex: Number(p.richIndex),
    cheapUsdX18: p.cheapUsdX18,
    richUsdX18: p.richUsdX18,
    deviationBps: Number(p.deviationBps),
    clipQuoteWei: p.clipQuoteWei,
    executable: p.executable,
  };
}

async function discoverMultiPairLaunchIds(
  publicClient: ReturnType<typeof createPublicClient>,
  factory: Address,
): Promise<bigint[]> {
  const count = (await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launchCount",
  })) as bigint;
  const n = Number(count);
  const out: bigint[] = [];
  for (let id = 1; id <= n; id++) {
    const markets = (await publicClient.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launchMarketCount",
      args: [BigInt(id)],
    })) as number;
    if (markets >= 2) out.push(BigInt(id));
  }
  return out;
}

async function readPreview(
  publicClient: ReturnType<typeof createPublicClient>,
  executor: Address,
  launchId: bigint,
): Promise<ArbPreview> {
  const raw = await publicClient.readContract({
    address: executor,
    abi: executorAbi,
    functionName: "preview",
    args: [launchId],
  });
  return parsePreview(raw);
}

async function readPoolKey(
  publicClient: ReturnType<typeof createPublicClient>,
  factory: Address,
  launchId: bigint,
  marketIndex: number,
): Promise<V4PoolKey> {
  const raw = await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "poolKeyOfMarket",
    args: [launchId, BigInt(marketIndex)],
  });
  const key = raw as V4PoolKey;
  return {
    currency0: key.currency0,
    currency1: key.currency1,
    fee: Number(key.fee),
    tickSpacing: Number(key.tickSpacing),
    hooks: key.hooks,
  };
}

/** Spend spendable USDG → cheap wStock. Skip when Quotrons USD is an outlier (would overpay 10x). */
async function prefundCheapFromUsdg(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  opts: {
    router: Address;
    cheapQuote: Address;
    usdgBuySane: boolean;
    account: Address;
    sendTo: Address;
  },
): Promise<bigint> {
  const { router, cheapQuote, usdgBuySane, account, sendTo } = opts;
  if (!usdgBuySane) {
    console.log(
      `[arb-keeper] skip USDG→${quoteLabel(cheapQuote)} — Quotrons/factory USD is not sane vs listing seed`,
    );
    return 0n;
  }
  if (isEthQuote(cheapQuote) || !isQuotronStock(cheapQuote)) return 0n;

  const usdgBuyOk = await canSwapUsdgForStock(publicClient, cheapQuote);
  if (!usdgBuyOk) {
    console.log(`[arb-keeper] USDG→${quoteLabel(cheapQuote)} tick-bound — using on-hand cheap wStock only`);
    return 0n;
  }

  const usdg = usdgAddr();
  const keeperUsdg = await readErc20Balance(publicClient, usdg, account);
  const reserve = BigInt(process.env.MULTI_PAIR_ARB_USDG_RESERVE ?? "10000");
  const budget = keeperUsdg > reserve ? keeperUsdg - reserve : 0n;
  if (budget === 0n) {
    console.log(`[arb-keeper] keeper USDG ${keeperUsdg} too low to buy ${quoteLabel(cheapQuote)}`);
    return 0n;
  }

  console.log(`[arb-keeper] USDG→${quoteLabel(cheapQuote)} spend ${budget} wei`);
  const stockOut = await swapUsdgForStock(publicClient, walletClient, router, cheapQuote, budget, account);
  if (stockOut === 0n) return 0n;
  if (sendTo.toLowerCase() !== account.toLowerCase()) {
    await transferErc20(walletClient, publicClient, cheapQuote, sendTo, stockOut);
    console.log(`[arb-keeper] sent ${stockOut} wei ${quoteLabel(cheapQuote)} → ${sendTo}`);
  }
  return stockOut;
}

/** Push keeper wStock inventory onto the executor (arb clips are capped by executor balance). */
async function moveKeeperCheapStockToExecutor(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  cheapQuote: Address,
  executor: Address,
  account: Address,
  launchId: bigint,
): Promise<bigint> {
  const keeperStock = await readErc20Balance(publicClient, cheapQuote, account);
  if (keeperStock === 0n) return 0n;

  await transferErc20(walletClient, publicClient, cheapQuote, executor, keeperStock);
  const send = keeperStock;
  console.log(
    `[arb-keeper] direct prefund launch ${launchId}: sent ${send} wei ${quoteLabel(cheapQuote)} keeper → executor`,
  );
  return send;
}

async function cheapQuoteForMarket(
  publicClient: ReturnType<typeof createPublicClient>,
  factory: Address,
  launchId: bigint,
  marketIndex: number,
): Promise<Address> {
  const launch = await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launches",
    args: [launchId],
  });
  const token = (launch as readonly [Address])[0];
  const cheapKey = await readPoolKey(publicClient, factory, launchId, marketIndex);
  return poolQuoteAddress(cheapKey, token);
}

async function launchMarketQuotes(
  publicClient: ReturnType<typeof createPublicClient>,
  factory: Address,
  launchId: bigint,
  marketCount: number,
): Promise<Address[]> {
  const quotes: Address[] = [];
  for (let i = 0; i < marketCount; i++) {
    quotes.push(await cheapQuoteForMarket(publicClient, factory, launchId, i));
  }
  return quotes;
}

async function logFuelBalances(
  publicClient: ReturnType<typeof createPublicClient>,
  executor: Address,
  keeper: Address,
  launchQuotes: Address[],
  cheapQuote: Address,
  prefix = "",
): Promise<void> {
  const cheap = cheapQuote.toLowerCase();
  const parts: string[] = [];
  for (const quote of launchQuotes) {
    const eb = await readErc20Balance(publicClient, quote, executor);
    const kb = await readErc20Balance(publicClient, quote, keeper);
    if (eb === 0n && kb === 0n) continue;
    const tag = quote.toLowerCase() === cheap ? "cheap" : "rich/other";
    parts.push(`${quoteLabel(quote)}[${tag}] exec=${eb} keeper=${kb}`);
  }
  const usdgBal = await readErc20Balance(publicClient, usdgAddr(), keeper);
  console.log(`${prefix}[arb-keeper] fuel ${parts.join(" ")} USDG=${usdgBal}`);
}

function logPreview(launchId: bigint, preview: ArbPreview, prefix = ""): void {
  console.log(
    `${prefix}[arb-keeper] launch ${launchId} markets=${preview.marketCount}` +
      ` cheap=${preview.cheapIndex} rich=${preview.richIndex}` +
      ` cheapUsd=${preview.cheapUsdX18} richUsd=${preview.richUsdX18}` +
      ` devBps=${preview.deviationBps} clip=${preview.clipQuoteWei} executable=${preview.executable}`,
  );
}

/** Pull rich / stranded launch wStocks → USDG (or cheap via launch pools). Keep the true cheap-leg quote. */
async function liquidateNonCheapLaunchStocks(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  opts: {
    factory: Address;
    executor: Address;
    router: Address;
    launchId: bigint;
    token: Address;
    cheapQuote: Address;
    cheapIndex: number;
    launchQuotes: Address[];
    keeper: Address;
  },
): Promise<void> {
  const { factory, executor, router, launchId, token, cheapQuote, cheapIndex, launchQuotes, keeper } = opts;
  const toLiquidate = nonCheapLaunchStocks(launchQuotes, cheapQuote);
  if (toLiquidate.length === 0) return;
  console.log(
    `[arb-keeper] liquidate non-cheap inventory → USDG: ${toLiquidate.map(quoteLabel).join(", ")}`,
  );

  for (const stock of toLiquidate) {
    const execBal = await readErc20Balance(publicClient, stock, executor);
    if (execBal === 0n) continue;
    const pulled = await withdrawExecutorErc20(
      publicClient,
      walletClient,
      executor,
      stock,
      keeper,
      execBal,
      keeper,
    );
    console.log(`[arb-keeper] pulled ${quoteLabel(stock)} ${execBal} wei from executor (ok=${pulled})`);
  }

  const cheapPoolKey = await readPoolKey(publicClient, factory, launchId, cheapIndex);
  const poolKeyByQuote = new Map<string, V4PoolKey>();
  for (let i = 0; i < launchQuotes.length; i++) {
    poolKeyByQuote.set(launchQuotes[i]!.toLowerCase(), await readPoolKey(publicClient, factory, launchId, i));
  }

  await sweepStocksToUsdg(publicClient, walletClient, router, keeper, {
    executor,
    excludeFromSweep: [cheapQuote],
    onlyStocks: toLiquidate,
    launchFallback: {
      token,
      cheapQuote,
      poolKeyForQuote: (quote) => poolKeyByQuote.get(quote.toLowerCase()) ?? null,
      convert: async (fromQuote, amountIn) => {
        const fromPoolKey = poolKeyByQuote.get(fromQuote.toLowerCase());
        if (!fromPoolKey) return 0n;
        return convertLaunchQuoteToCheapQuote(publicClient, walletClient, router, {
          token,
          fromQuote,
          fromPoolKey,
          cheapQuote,
          cheapPoolKey,
          amountIn,
          account: keeper,
        });
      },
    },
  });
}

async function pullExecutorStock(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  executor: Address,
  stock: Address,
  keeper: Address,
): Promise<bigint> {
  const execBal = await readErc20Balance(publicClient, stock, executor);
  if (execBal === 0n) return 0n;
  const pulled = await withdrawExecutorErc20(
    publicClient,
    walletClient,
    executor,
    stock,
    keeper,
    execBal,
    keeper,
  );
  if (pulled) {
    console.log(`[arb-keeper] pulled ${quoteLabel(stock)} ${execBal} wei from executor`);
    return execBal;
  }
  return 0n;
}

async function main() {
  const enabled = envBool("MULTI_PAIR_ARB", false);
  if (!enabled) {
    console.log("[arb-keeper] disabled (MULTI_PAIR_ARB=false). No RPC calls.");
    return;
  }

  const dryRun = envBool("MULTI_PAIR_ARB_DRY_RUN", true);
  const prefundUsdg = envBool("MULTI_PAIR_ARB_PREFUND_USDG", true);
  const sweepUsdg = envBool("MULTI_PAIR_ARB_SWEEP_USDG", true);
  const executor = envAddr("MULTI_PAIR_ARB_EXECUTOR");
  if (!executor) {
    throw new Error("Set MULTI_PAIR_ARB_EXECUTOR when MULTI_PAIR_ARB=true");
  }
  const router = routerAddr();
  const manualLaunchIds = envLaunchIds();
  const autoDiscover = envBool("MULTI_PAIR_ARB_AUTO", manualLaunchIds === null);

  const rpc = resolveInkRpcUrl();
  const hasKeeperKey = Boolean((process.env.FEE_KEEPER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim());
  const account = privateKeyToAccount(pk(!dryRun));
  const publicClient = createPublicClient({ chain: INK, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: INK, transport: http(rpc) });

  const chainId = await publicClient.getChainId();
  if (chainId !== 57073) throw new Error(`Expected Ink 57073, got ${chainId}`);

  const paused = await publicClient.readContract({ address: executor, abi: executorAbi, functionName: "paused" });
  const maxClip = await publicClient.readContract({
    address: executor,
    abi: executorAbi,
    functionName: "maxClipUsdX18",
  });
  const minDev = await publicClient.readContract({
    address: executor,
    abi: executorAbi,
    functionName: "minDeviationBps",
  });
  const hook = await publicClient.readContract({ address: executor, abi: executorAbi, functionName: "hook" });
  const factoryAddr =
    factoryFromEnv() ??
    ((await publicClient.readContract({
      address: executor,
      abi: executorAbi,
      functionName: "factory",
    })) as Address);

  let arbActive = false;
  let arbExecutor: Address | null = null;
  try {
    arbActive = await publicClient.readContract({ address: hook, abi: hookAbi, functionName: "arbActive" });
    arbExecutor = await publicClient.readContract({ address: hook, abi: hookAbi, functionName: "arbExecutor" });
  } catch {
    console.log("[arb-keeper] hook has no arb path (current Ink deploy). Leave MULTI_PAIR_ARB=false.");
    return;
  }

  console.log("[arb-keeper] executor", executor);
  console.log("[arb-keeper] factory", factoryAddr);
  console.log("[arb-keeper] hook", hook);
  console.log("[arb-keeper] router", router ?? "(unset — USDG prefund disabled)");
  console.log("[arb-keeper] paused", paused, "maxClipUsd", maxClip.toString(), "minDeviationBps", minDev);
  console.log("[arb-keeper] arbActive", arbActive, "arbExecutor", arbExecutor);
  console.log(
    "[arb-keeper] dryRun",
    dryRun,
    "prefundUsdg",
    prefundUsdg,
    "sweepUsdg",
    sweepUsdg,
    "keeper",
    hasKeeperKey ? account.address : "not configured",
  );

  let launchIds: bigint[];
  if (manualLaunchIds !== null) {
    launchIds = manualLaunchIds;
    console.log("[arb-keeper] using MULTI_PAIR_ARB_LAUNCH_IDS", launchIds.map(String).join(","));
  } else if (!autoDiscover) {
    console.log("[arb-keeper] auto-discovery off and no MULTI_PAIR_ARB_LAUNCH_IDS; nothing to do");
    return;
  } else {
    launchIds = await discoverMultiPairLaunchIds(publicClient, factoryAddr);
    console.log(
      `[arb-keeper] auto-discovered ${launchIds.length} launchMulti id(s):`,
      launchIds.length ? launchIds.map(String).join(",") : "(none yet)",
    );
    if (launchIds.length === 0) {
      console.log("[arb-keeper] ARB_KEEPER_OK");
      return;
    }
  }

  for (const launchId of launchIds) {
    try {
    const preview = await readPreview(publicClient, executor, launchId);
    logPreview(launchId, preview);
    if (preview.marketCount < 2) continue;

    const launch = await publicClient.readContract({
      address: factoryAddr,
      abi: launchFactoryAbi,
      functionName: "launches",
      args: [launchId],
    });
    const token = (launch as readonly [Address])[0];
    const launchQuotes = await launchMarketQuotes(publicClient, factoryAddr, launchId, preview.marketCount);
    const poolKeys: V4PoolKey[] = [];
    const factoryUsdByQuote = new Map<string, number>();
    for (let i = 0; i < launchQuotes.length; i++) {
      poolKeys.push(await readPoolKey(publicClient, factoryAddr, launchId, i));
      const q = launchQuotes[i]!;
      if (isEthQuote(q)) continue;
      try {
        const x18 = (await publicClient.readContract({
          address: factoryAddr,
          abi: launchFactoryAbi,
          functionName: "quoteUsdPriceX18",
          args: [q],
        })) as bigint;
        factoryUsdByQuote.set(q.toLowerCase(), Number(x18) / 1e18);
      } catch {
        factoryUsdByQuote.set(q.toLowerCase(), 0);
      }
    }

    let sane = await rankLaunchMarkets(publicClient, {
      token,
      quotes: launchQuotes,
      poolKeys,
      factoryUsdByQuote,
      onChainCheapIndex: preview.cheapIndex,
      onChainRichIndex: preview.richIndex,
    });
    if (!sane) {
      console.log(`[arb-keeper] launch ${launchId}: cannot rank markets`);
      continue;
    }

    if (!sane.usdgBuySane) {
      const cheapOnKeeper = await readErc20Balance(publicClient, sane.cheapQuote, account.address);
      const cheapOnExecutor = await readErc20Balance(publicClient, sane.cheapQuote, executor);
      if (cheapOnKeeper === 0n && cheapOnExecutor === 0n) {
        const rest = sane.markets.filter((m) => m.index !== sane.cheapIndex);
        const fallback = previewFromMarkets(rest, preview.cheapIndex, preview.richIndex);
        if (!fallback) {
          console.log(
            `[arb-keeper] launch ${launchId}: skip — cheap ${quoteLabel(sane.cheapQuote)} USDG buy is insane and no other pair`,
          );
          continue;
        }
        console.log(
          `[arb-keeper] launch ${launchId}: skip unusable cheap ${quoteLabel(sane.cheapQuote)}` +
            ` (insane Quotrons USD, no inventory); fallback ${quoteLabel(fallback.cheapQuote)} → ${quoteLabel(fallback.richQuote)}`,
        );
        sane = fallback;
      }
    }

    const skewed = sane.deviationBps >= Number(minDev);
    if (!dryRun && router && sweepUsdg) {
      await liquidateNonCheapLaunchStocks(publicClient, walletClient, {
        factory: factoryAddr,
        executor,
        router,
        launchId,
        token,
        cheapQuote: sane.cheapQuote,
        cheapIndex: sane.cheapIndex,
        launchQuotes,
        keeper: account.address,
      });
    }

    if (!skewed) {
      console.log(`[arb-keeper] launch ${launchId} deviation ${sane.deviationBps} bps below min ${minDev}`);
      if (!dryRun && router && sweepUsdg && sane.usdgBuySane) {
        await sweepStocksToUsdg(publicClient, walletClient, router, account.address, {
          executor,
          onlyStocks: [sane.cheapQuote],
        });
      }
      continue;
    }

    await logFuelBalances(
      publicClient,
      executor,
      account.address,
      launchQuotes,
      sane.cheapQuote,
      "[arb-keeper] pre-arb ",
    );

    if (dryRun) {
      console.log(
        `[arb-keeper] dry-run would arb ${quoteLabel(sane.cheapQuote)} → token → ${quoteLabel(sane.richQuote)}` +
          (sane.matchesOnChain ? " via executor" : " via router (on-chain oracle disagrees)"),
      );
      continue;
    }
    if (!router) {
      console.log("[arb-keeper] no router — cannot prefund or router-arb");
      continue;
    }

    if (!dryRun) {
      await pullExecutorStock(publicClient, walletClient, executor, sane.cheapQuote, account.address);
    }

    if (prefundUsdg) {
      await prefundCheapFromUsdg(publicClient, walletClient, {
        router,
        cheapQuote: sane.cheapQuote,
        usdgBuySane: sane.usdgBuySane,
        account: account.address,
        sendTo: sane.matchesOnChain ? executor : account.address,
      });
    }

    if (sane.matchesOnChain) {
      await moveKeeperCheapStockToExecutor(
        publicClient,
        walletClient,
        sane.cheapQuote,
        executor,
        account.address,
        launchId,
      );
      const funded = await readPreview(publicClient, executor, launchId);
      logPreview(launchId, funded, "[arb-keeper] funded ");
      if (!funded.executable) {
        console.log(
          `[arb-keeper] skip execute(${launchId}): need ${quoteLabel(sane.cheapQuote)} on executor`,
        );
      } else {
        const hash = (await walletClient.writeContract({
          address: executor,
          abi: executorAbi,
          functionName: "execute",
          args: [launchId],
        })) as Hash;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          console.error(`[arb-keeper] execute(${launchId}) reverted (${hash})`);
        } else {
          console.log(`[arb-keeper] ok execute ${launchId} ${hash}`);
        }
      }
    } else {
      const cheapOnKeeper = await readErc20Balance(publicClient, sane.cheapQuote, account.address);
      if (cheapOnKeeper === 0n) {
        console.log(
          `[arb-keeper] skip router arb: no ${quoteLabel(sane.cheapQuote)} (and USDG buy is ${sane.usdgBuySane ? "ok" : "blocked as insane oracle"})`,
        );
      } else {
        const result = await executeLaunchArb(publicClient, walletClient, router, {
          token,
          cheapQuote: sane.cheapQuote,
          cheapPoolKey: poolKeys[sane.cheapIndex]!,
          richQuote: sane.richQuote,
          richPoolKey: poolKeys[sane.richIndex]!,
          cheapAmountIn: cheapOnKeeper,
          account: account.address,
        });
        console.log(
          `[arb-keeper] ok router arb launch ${launchId} tokenSold=${result.tokenSold} quoteOut=${result.quoteOut}`,
        );
      }
    }

    if (sweepUsdg) {
      await liquidateNonCheapLaunchStocks(publicClient, walletClient, {
        factory: factoryAddr,
        executor,
        router,
        launchId,
        token,
        cheapQuote: sane.cheapQuote,
        cheapIndex: sane.cheapIndex,
        launchQuotes,
        keeper: account.address,
      });
      if (sane.usdgBuySane) {
        await sweepStocksToUsdg(publicClient, walletClient, router, account.address, {
          executor,
          onlyStocks: [sane.cheapQuote],
        });
      } else {
        const leftoverCheap = await readErc20Balance(publicClient, sane.cheapQuote, account.address);
        if (leftoverCheap > 0n) {
          console.log(
            `[arb-keeper] keep ${quoteLabel(sane.cheapQuote)} (${leftoverCheap} wei) — USDG buy not sane`,
          );
        }
      }
    }

    await logFuelBalances(
      publicClient,
      executor,
      account.address,
      launchQuotes,
      sane.cheapQuote,
      "[arb-keeper] post-arb ",
    );
    } catch (err) {
      console.error(`[arb-keeper] launch ${launchId} FAILED`, err);
    }
  }

  if (!dryRun) {
    await logKeeperUsdgBalance(publicClient, account.address);
  }

  console.log("[arb-keeper] ARB_KEEPER_OK");
}

main().catch((err) => {
  console.error("[arb-keeper] FAILED", err);
  process.exit(1);
});

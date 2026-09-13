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
 *   MULTI_PAIR_ARB_PREFUND_USDG=true     swap keeper USDG → cheap wStock for executor
 *   MULTI_PAIR_ARB_SWEEP_USDG=true       sweep executor wStock → keeper USDG after arb
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

import {
  QUOTRON_STOCKS,
  isEthQuote,
  isQuotronStock,
  poolQuoteAddress,
  prefundUsdgBudget,
  readErc20Balance,
  routerAddr,
  swapStockForUsdg,
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

async function prefundExecutorCheapLeg(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  opts: {
    factory: Address;
    executor: Address;
    router: Address;
    launchId: bigint;
    cheapIndex: number;
    maxClipUsdX18: bigint;
    account: Address;
  },
): Promise<void> {
  const { factory, executor, router, launchId, cheapIndex, maxClipUsdX18, account } = opts;
  const usdg = usdgAddr();

  const launch = await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launches",
    args: [launchId],
  });
  const token = (launch as readonly [Address])[0];

  const cheapKey = await readPoolKey(publicClient, factory, launchId, cheapIndex);
  const cheapQuote = poolQuoteAddress(cheapKey, token);

  if (isEthQuote(cheapQuote)) {
    console.log("[arb-keeper] cheap leg is ETH — prefund USDG not supported; fund executor with ETH");
    return;
  }
  if (!isQuotronStock(cheapQuote)) {
    console.log(`[arb-keeper] cheap quote ${cheapQuote} is not a Quotrons wStock — skip USDG prefund`);
    return;
  }

  const keeperUsdg = await readErc20Balance(publicClient, usdg, account);
  const budget = prefundUsdgBudget(keeperUsdg, maxClipUsdX18);
  if (budget === 0n) {
    console.log(`[arb-keeper] keeper USDG balance ${keeperUsdg} too low to prefund`);
    return;
  }

  console.log(
    `[arb-keeper] prefund launch ${launchId}: swap ${budget} USDG wei → ${cheapQuote} for executor`,
  );
  const stockOut = await swapUsdgForStock(publicClient, walletClient, router, cheapQuote, budget, account);
  if (stockOut === 0n) {
    console.log("[arb-keeper] USDG→wStock swap returned 0");
    return;
  }
  await transferErc20(walletClient, publicClient, cheapQuote, executor, stockOut);
  console.log(`[arb-keeper] prefund ok — sent ${stockOut} wei ${cheapQuote} to executor`);
}

async function sweepExecutorStocksToUsdg(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  executor: Address,
  router: Address,
  account: Address,
): Promise<void> {
  for (const stock of QUOTRON_STOCKS) {
    const bal = await readErc20Balance(publicClient, stock, executor);
    if (bal === 0n) continue;
    const pulled = await withdrawExecutorErc20(
      publicClient,
      walletClient,
      executor,
      stock,
      account,
      bal,
      account,
    );
    if (!pulled) return;
    const usdgOut = await swapStockForUsdg(publicClient, walletClient, router, stock, bal, account);
    console.log(`[arb-keeper] sweep ${stock} → ${usdgOut} USDG wei`);
  }
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
    let preview = await readPreview(publicClient, executor, launchId);
    console.log(
      `[arb-keeper] launch ${launchId} markets=${preview.marketCount} cheap=${preview.cheapIndex} rich=${preview.richIndex}` +
        ` cheapUsd=${preview.cheapUsdX18} richUsd=${preview.richUsdX18} devBps=${preview.deviationBps}` +
        ` clip=${preview.clipQuoteWei} executable=${preview.executable}`,
    );

    const skewed =
      preview.marketCount >= 2 &&
      preview.deviationBps >= Number(minDev) &&
      preview.cheapUsdX18 > 0n &&
      preview.cheapIndex !== preview.richIndex;

    if (!preview.executable && skewed && prefundUsdg && router && !dryRun) {
      await prefundExecutorCheapLeg(publicClient, walletClient, {
        factory: factoryAddr,
        executor,
        router,
        launchId,
        cheapIndex: preview.cheapIndex,
        maxClipUsdX18: maxClip,
        account: account.address,
      });
      preview = await readPreview(publicClient, executor, launchId);
      console.log(
        `[arb-keeper] after prefund launch ${launchId} clip=${preview.clipQuoteWei} executable=${preview.executable}`,
      );
    } else if (!preview.executable && skewed && prefundUsdg && dryRun) {
      console.log(`[arb-keeper] dry-run would prefund cheap leg from keeper USDG for launch ${launchId}`);
    }

    if (!preview.executable) continue;
    if (dryRun) {
      console.log(`[arb-keeper] dry-run skip execute(${launchId})`);
      continue;
    }

    const hash = (await walletClient.writeContract({
      address: executor,
      abi: executorAbi,
      functionName: "execute",
      args: [launchId],
    })) as Hash;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`execute(${launchId}) reverted (${hash})`);
    console.log(`[arb-keeper] ok execute ${launchId} ${hash}`);

    if (sweepUsdg && router) {
      await sweepExecutorStocksToUsdg(publicClient, walletClient, executor, router, account.address);
    }
  }

  console.log("[arb-keeper] ARB_KEEPER_OK");
}

main().catch((err) => {
  console.error("[arb-keeper] FAILED", err);
  process.exit(1);
});

/**
 * One-shot on-chain probe for Hookit Ink issues.
 * Run: cd web && node --env-file=.env.local scripts/onchain-probe.mjs
 */
import {
  createPublicClient,
  http,
  getAddress,
  zeroAddress,
  keccak256,
  encodeAbiParameters,
  parseAbi,
  formatEther,
  formatUnits,
} from "viem";

const rpc = process.env.NEXT_PUBLIC_INK_RPC_URL || process.env.INK_RPC_URL;
if (!rpc) {
  console.error("Missing RPC");
  process.exit(1);
}

const client = createPublicClient({ transport: http(rpc) });

const V2_FACTORY = getAddress("0xeb05916aC2356956224c7d9B75C0c8c01503d24C");
const ENV_FACTORY = process.env.NEXT_PUBLIC_LAUNCH_FACTORY
  ? getAddress(process.env.NEXT_PUBLIC_LAUNCH_FACTORY)
  : null;
const DIST = getAddress("0x302e52f0252360325796b7eb6a03409de40266ac");
const MASTER_HOOK = getAddress("0xfe09ecab802e3567df96b94d2a4ec294b6272ac8");
const GRAD_HOOK = getAddress("0xfe9be77c9b3349ba1095a150bd29a48fc9a9e088");
const BONDING = getAddress("0x0E6504F6E6Aa5e3009Ec3E5aFA52fCa1306f8dBe");
const DYNAMIC_FEE_FLAG = 0x800000;
const FLAG_DYNAMIC_FEES = 1n << 5n;

const tokens = [
  getAddress("0x86512f63b1E0Ca717C65325DB8100233FD185088"),
  getAddress("0xA4214e583d5778Bab289C3202BEF336f59E84DF8"),
];

const factoryAbi = parseAbi([
  "function launchCount() view returns (uint256)",
  "function tokenLaunchId(address token) view returns (uint256)",
  "function launches(uint256 launchId) view returns (address token, address creator, address hooks, bool customHook, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity)",
  "function launchQuote(uint256 launchId) view returns (address)",
  "function launchedAt(uint256 launchId) view returns (uint64)",
  "function poolKeyOf(uint256 launchId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))",
  "function launchMarketCount(uint256 launchId) view returns (uint8)",
  "function launchMarkets(uint256 launchId, uint256 index) view returns (address quote, uint16 bps, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity)",
  "function ethUsdPriceX18() view returns (uint256)",
  "function masterHook() view returns (address)",
]);

const queryAbi = parseAbi([
  "function getLaunchPage(uint256 startId, uint256 limit) view returns ((address token, address creator, address hooks, bool customHook, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity)[] infos, uint256[] bitmasks, uint64[] timestamps, uint256 total)",
]);

// LaunchFactoryQuery address from deploy
const V2_QUERY = getAddress("0x9abeefb6addacdccaf85003bc6d0e4c636ddaeab");

const distAbi = parseAbi([
  "function pending(address token) view returns (uint256)",
  "function totalDistributed(address token) view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);

function poolIdFromKey(key) {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { type: "address", name: "currency0" },
            { type: "address", name: "currency1" },
            { type: "uint24", name: "fee" },
            { type: "int24", name: "tickSpacing" },
            { type: "address", name: "hooks" },
          ],
        },
      ],
      [key],
    ),
  );
}

async function probeFactory(label, factory) {
  const count = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "launchCount",
  });
  let ethUsd = null;
  try {
    ethUsd = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "ethUsdPriceX18",
    });
  } catch {
    /* older factory */
  }
  let masterHook = null;
  try {
    masterHook = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "masterHook",
    });
  } catch {
    /* */
  }
  return {
    label,
    factory,
    count: count.toString(),
    ethUsd: ethUsd ? Number(formatUnits(ethUsd, 18)).toFixed(2) : null,
    masterHook,
  };
}

async function probeToken(token, factory) {
  const id = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "tokenLaunchId",
    args: [token],
  });
  if (id === 0n) {
    return { token, found: false };
  }

  const launchArr = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "launches",
    args: [id],
  });
  // viem may return tuple as array or object depending on ABI
  const launch = Array.isArray(launchArr)
    ? {
        token: launchArr[0],
        creator: launchArr[1],
        hooks: launchArr[2],
        customHook: launchArr[3],
        poolId: launchArr[4],
        tickLower: launchArr[5],
        tickUpper: launchArr[6],
        liquidity: launchArr[7],
      }
    : launchArr;

  const [quote, launchedAt, keyRaw, marketCount, name, symbol, supply] =
    await Promise.all([
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "launchQuote",
        args: [id],
      }),
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "launchedAt",
        args: [id],
      }),
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "poolKeyOf",
        args: [id],
      }),
      client.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "launchMarketCount",
        args: [id],
      }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
    ]);

  const key = Array.isArray(keyRaw)
    ? {
        currency0: keyRaw[0],
        currency1: keyRaw[1],
        fee: keyRaw[2],
        tickSpacing: keyRaw[3],
        hooks: keyRaw[4],
      }
    : keyRaw;

  // Get bitmask from query page around this id
  let bitmask = null;
  let dynamicFees = null;
  try {
    const page = await client.readContract({
      address: V2_QUERY,
      abi: queryAbi,
      functionName: "getLaunchPage",
      args: [id, 1n],
    });
    // getLaunchPage(startId, limit) — start may be exclusive/inclusive; try factory query via ENV
    bitmask = page[1]?.[0] ?? null;
  } catch {
    /* */
  }

  // Also try LaunchFactoryQuery attached - or read from MasterLaunchHook storage
  // Fall back: scan bitmasks from getLaunchPage on factory itself if it has the fn
  try {
    const pageOnFactory = await client.readContract({
      address: factory,
      abi: queryAbi,
      functionName: "getLaunchPage",
      args: [id > 0n ? id - 1n : 0n, 5n],
    });
    const infos = pageOnFactory[0];
    const masks = pageOnFactory[1];
    const idx = infos.findIndex((i) => i.token.toLowerCase() === token.toLowerCase());
    if (idx >= 0) {
      bitmask = masks[idx];
      dynamicFees = (bitmask & FLAG_DYNAMIC_FEES) !== 0n;
    }
  } catch {
    /* */
  }

  const markets = [];
  for (let i = 0; i < Number(marketCount); i++) {
    const m = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: "launchMarkets",
      args: [id, BigInt(i)],
    });
    markets.push({
      quote: m[0],
      bps: m[1],
      poolId: m[2],
      liquidity: m[5].toString(),
    });
  }

  const onChainKey = {
    currency0: key.currency0,
    currency1: key.currency1,
    fee: Number(key.fee),
    tickSpacing: Number(key.tickSpacing),
    hooks: key.hooks,
  };
  const feeAsDynamic = onChainKey.fee === DYNAMIC_FEE_FLAG;
  const wrongStaticFee = onChainKey.fee > 0 && onChainKey.fee !== DYNAMIC_FEE_FLAG;

  // Frontend resolvePoolLpFee behavior:
  // if lpFee > 0 return lpFee; else if dynamicFees return 0x800000
  const frontendFeeIfLpFeeStored = onChainKey.fee; // hydrate uses this
  const frontendFeeIfZeroAndDynamic =
    dynamicFees === true ? DYNAMIC_FEE_FLAG : onChainKey.fee;

  const hashedOnChain = poolIdFromKey(onChainKey);
  const hashedWithDynamic = poolIdFromKey({ ...onChainKey, fee: DYNAMIC_FEE_FLAG });
  const hashedWithZero = poolIdFromKey({ ...onChainKey, fee: 0 });

  const dead = getAddress("0x000000000000000000000000000000000000dEaD");
  const burned = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [dead],
  });

  return {
    token,
    found: true,
    factory,
    launchId: id.toString(),
    name,
    symbol,
    quote,
    hooks: launch.hooks,
    poolIdStored: launch.poolId,
    liquidity: launch.liquidity.toString(),
    launchedAt: Number(launchedAt),
    marketCount: Number(marketCount),
    markets,
    onChainKey,
    feeHex: "0x" + onChainKey.fee.toString(16),
    feeAsDynamic,
    wrongStaticFee,
    bitmask: bitmask?.toString() ?? null,
    dynamicFees,
    poolIdMatch: {
      stored: launch.poolId,
      hashedOnChainKey: hashedOnChain,
      matchStored: launch.poolId.toLowerCase() === hashedOnChain.toLowerCase(),
      hashedDynamicFee: hashedWithDynamic,
      matchIfForceDynamic:
        launch.poolId.toLowerCase() === hashedWithDynamic.toLowerCase(),
      hashedZeroFee: hashedWithZero,
      matchIfZero: launch.poolId.toLowerCase() === hashedWithZero.toLowerCase(),
    },
    frontendFeeIfUsingStoredLpFee: frontendFeeIfLpFeeStored,
    frontendFeeIfZeroAndDynamicFlag: frontendFeeIfZeroAndDynamic,
    supply: formatEther(supply),
    burnedDead: formatEther(burned),
  };
}

async function probeDistributor() {
  // ETH native pending as address(0)
  let pendingEth = null;
  let totalEth = null;
  try {
    pendingEth = await client.readContract({
      address: DIST,
      abi: distAbi,
      functionName: "pending",
      args: [zeroAddress],
    });
  } catch (e) {
    pendingEth = e.shortMessage || String(e);
  }
  try {
    totalEth = await client.readContract({
      address: DIST,
      abi: distAbi,
      functionName: "totalDistributed",
      args: [zeroAddress],
    });
  } catch (e) {
    totalEth = e.shortMessage || String(e);
  }
  return {
    pendingEth:
      typeof pendingEth === "bigint" ? formatEther(pendingEth) : pendingEth,
    totalDistributedEth:
      typeof totalEth === "bigint" ? formatEther(totalEth) : totalEth,
  };
}

async function probeGraduatedHookPush() {
  // Heuristic: search bytecode for notifyInternal selector
  // notifyInternal(address,uint256) = keccak256("notifyInternal(address,uint256)")[:4]
  const code = await client.getBytecode({ address: GRAD_HOOK });
  const sel = keccak256(
    new TextEncoder().encode("notifyInternal(address,uint256)"),
  ).slice(2, 10);
  const hasNotify = (code || "").toLowerCase().includes(sel.toLowerCase());
  return { gradHookHasNotifyInternalSelector: hasNotify, selector: "0x" + sel };
}

const out = {
  rpcHost: new URL(rpc).host,
  block: (await client.getBlockNumber()).toString(),
  factories: [],
  tokens: [],
  distributor: null,
  gradHook: null,
};

out.factories.push(await probeFactory("v2-deploy", V2_FACTORY));
if (ENV_FACTORY && ENV_FACTORY.toLowerCase() !== V2_FACTORY.toLowerCase()) {
  out.factories.push(await probeFactory("env-local", ENV_FACTORY));
}

for (const t of tokens) {
  let result = await probeToken(t, V2_FACTORY);
  if (!result.found && ENV_FACTORY) {
    result = await probeToken(t, ENV_FACTORY);
  }
  // also try bonding? unlikely for dynamic fees
  out.tokens.push(result);
}

out.distributor = await probeDistributor();
out.gradHook = await probeGraduatedHookPush();

// Indexer health
try {
  const idx = process.env.NEXT_PUBLIC_INDEXER_URL || "https://indexer.hookit.fun";
  const r = await fetch(`${idx.replace(/\/$/, "")}/health`, {
    signal: AbortSignal.timeout(8000),
  });
  out.indexer = { url: idx, status: r.status, body: await r.text() };
} catch (e) {
  out.indexer = { error: String(e.message || e) };
}

console.log(JSON.stringify(out, null, 2));

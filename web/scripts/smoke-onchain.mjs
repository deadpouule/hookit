/**
 * On-chain smoke for Hookit Ink — exit 0 if all critical checks pass.
 *
 *   cd web && npm run smoke:onchain
 *
 * Optional live buy (test wallet only — NEVER use a hot wallet key):
 *   SMOKE_PRIVATE_KEY=0x... SMOKE_BUY_ETH=0.0001 npm run smoke:onchain
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  zeroAddress,
  parseAbi,
  formatEther,
  formatUnits,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc =
  process.env.NEXT_PUBLIC_INK_RPC_URL ||
  process.env.INK_RPC_URL ||
  process.env.INK_RPC_URL_BACKUP ||
  "https://rpc-gel.inkonchain.com";

const V2_FACTORY = getAddress("0xeb05916aC2356956224c7d9B75C0c8c01503d24C");
const ENV_FACTORY = process.env.NEXT_PUBLIC_LAUNCH_FACTORY
  ? getAddress(process.env.NEXT_PUBLIC_LAUNCH_FACTORY)
  : null;
// Prefer Ink v2 deploy factory — local .env may still point at an older factory.
const FACTORY =
  process.env.SMOKE_FACTORY
    ? getAddress(process.env.SMOKE_FACTORY)
    : process.env.SMOKE_USE_ENV_FACTORY === "1" && ENV_FACTORY
      ? ENV_FACTORY
      : V2_FACTORY;
const DIST = getAddress("0x302e52f0252360325796b7eb6a03409de40266ac");
const QUOTER = getAddress("0x3972C00f7ed4885e145823eb7C655375d275A1C5");
const STATE_VIEW = getAddress("0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990");
const ETH_USD_FEED = getAddress("0xe5867B1d421f0b52697F16e2ac437e87d66D5fbF");
const DYNAMIC_FEE_FLAG = 0x800000;
const FLAG_DYNAMIC_FEES = 1n << 5n;

const DYNAMIC_TOKENS = [
  getAddress("0x86512f63b1E0Ca717C65325DB8100233FD185088"),
  getAddress("0xA4214e583d5778Bab289C3202BEF336f59E84DF8"),
];

const ink = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
};

const client = createPublicClient({ chain: ink, transport: http(rpc) });

const factoryAbi = parseAbi([
  "function launchCount() view returns (uint256)",
  "function tokenLaunchId(address) view returns (uint256)",
  "function poolKeyOf(uint256) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))",
  "function launches(uint256) view returns (address,address,address,bool,bytes32,int24,int24,uint128)",
  "function getLaunchPage(uint256,uint256) view returns ((address,address,address,bool,bytes32,int24,int24,uint128)[],uint256[],uint64[],uint256)",
  "function ethUsdPriceX18() view returns (uint256)",
]);

const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
];

const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  "function decimals() view returns (uint8)",
]);

const distAbi = parseAbi(["function pending(address) view returns (uint256)"]);

const results = [];

function pass(name, detail) {
  results.push({ ok: true, name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function asKey(raw) {
  if (Array.isArray(raw)) {
    return {
      currency0: raw[0],
      currency1: raw[1],
      fee: Number(raw[2]),
      tickSpacing: Number(raw[3]),
      hooks: raw[4],
    };
  }
  return {
    currency0: raw.currency0,
    currency1: raw.currency1,
    fee: Number(raw.fee),
    tickSpacing: Number(raw.tickSpacing),
    hooks: raw.hooks,
  };
}

async function quoteBuy(key, amountIn = parseEther("0.001")) {
  const zeroForOne = key.currency0.toLowerCase() === zeroAddress;
  const sim = await client.simulateContract({
    address: QUOTER,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: key,
        zeroForOne,
        exactAmount: amountIn,
        hookData: "0x",
      },
    ],
    account: "0x0000000000000000000000000000000000000001",
  });
  return sim.result[0];
}

async function main() {
  console.log(`\nHookit on-chain smoke @ ${new URL(rpc).host}`);
  console.log(`Factory ${FACTORY}${ENV_FACTORY && ENV_FACTORY !== FACTORY ? ` (env local=${ENV_FACTORY})` : ""}\n`);

  const block = await client.getBlockNumber();
  pass("RPC reachable", `block ${block}`);

  const count = await client.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "launchCount",
  });
  if (count > 0n) pass("LaunchFactory has launches", `count=${count}`);
  else fail("LaunchFactory has launches", "count=0");

  // Live ETH/USD feed
  const rd = await client.readContract({
    address: ETH_USD_FEED,
    abi: feedAbi,
    functionName: "latestRoundData",
  });
  const dec = await client.readContract({
    address: ETH_USD_FEED,
    abi: feedAbi,
    functionName: "decimals",
  });
  const liveUsd = Number(rd[1]) / 10 ** Number(dec);
  if (liveUsd > 500 && liveUsd < 20_000) pass("ETH/USD feed live", `$${liveUsd.toFixed(2)}`);
  else fail("ETH/USD feed live", String(liveUsd));

  let factoryUsd = 0;
  try {
    const x18 = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "ethUsdPriceX18",
    });
    factoryUsd = Number(formatEther(x18));
    const drift = Math.abs(factoryUsd - liveUsd) / liveUsd;
    if (drift > 0.15) {
      fail(
        "Factory ethUsdPriceX18 synced",
        `factory=$${factoryUsd.toFixed(0)} feed=$${liveUsd.toFixed(0)} drift=${(drift * 100).toFixed(0)}% — call syncEthUsdPrice()`,
      );
    } else {
      pass("Factory ethUsdPriceX18 synced", `$${factoryUsd.toFixed(2)}`);
    }
  } catch (e) {
    fail("Factory ethUsdPriceX18", e.shortMessage || String(e));
  }

  // Indexer
  const indexerUrl = (process.env.NEXT_PUBLIC_INDEXER_URL || "https://indexer.hookit.fun").replace(
    /\/$/,
    "",
  );
  try {
    const health = await fetch(`${indexerUrl}/health`, { signal: AbortSignal.timeout(10_000) }).then(
      (r) => r.json(),
    );
    if (health.ok && Number(health.lagBlocks) < 500) {
      pass("Indexer healthy", `lag=${health.lagBlocks} tokens=${health.tokens}`);
    } else if (health.ok) {
      fail("Indexer healthy", `lag=${health.lagBlocks} (too far behind)`);
    } else {
      fail("Indexer healthy", JSON.stringify(health));
    }
  } catch (e) {
    fail("Indexer healthy", String(e.message || e));
  }

  // Protocol pending (informational — Classic push may still be undeployed)
  try {
    const pending = await client.readContract({
      address: DIST,
      abi: distAbi,
      functionName: "pending",
      args: [zeroAddress],
    });
    pass("Distributor pending(ETH) readable", `${formatEther(pending)} ETH`);
  } catch (e) {
    fail("Distributor pending(ETH)", e.shortMessage || String(e));
  }

  // Dynamic-fee tokens: fee flag + quoter
  for (const token of DYNAMIC_TOKENS) {
    const id = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "tokenLaunchId",
      args: [token],
    });
    if (id === 0n) {
      fail(`Token ${token.slice(0, 8)}… registered`, "tokenLaunchId=0");
      continue;
    }
    const key = asKey(
      await client.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "poolKeyOf",
        args: [id],
      }),
    );
    if (key.fee === DYNAMIC_FEE_FLAG) {
      pass(`${token.slice(0, 8)}… PoolKey fee`, "0x800000");
    } else {
      fail(`${token.slice(0, 8)}… PoolKey fee`, `got 0x${key.fee.toString(16)}`);
    }

    try {
      const out = await quoteBuy(key);
      pass(`${token.slice(0, 8)}… quoter buy 0.001 ETH`, `out=${formatEther(out).slice(0, 12)} tokens`);
    } catch (e) {
      fail(`${token.slice(0, 8)}… quoter buy 0.001 ETH`, e.shortMessage || String(e));
    }

    try {
      await quoteBuy({ ...key, fee: 0 });
      fail(`${token.slice(0, 8)}… fee=0 must fail`, "quote unexpectedly succeeded");
    } catch {
      pass(`${token.slice(0, 8)}… fee=0 correctly reverts`);
    }
  }

  // Optional tiny buy with test key
  const pk = process.env.SMOKE_PRIVATE_KEY;
  if (pk) {
    const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
    const wallet = createWalletClient({
      account,
      chain: ink,
      transport: http(rpc),
    });
    const bal = await client.getBalance({ address: account.address });
    pass("Smoke wallet funded", `${account.address} bal=${formatEther(bal)} ETH`);
    const buyEth = process.env.SMOKE_BUY_ETH || "0.0001";
    console.log(`\n(Optional live buy skipped in smoke — set SMOKE_EXECUTE_BUY=1 to send ${buyEth} ETH)`);
    if (process.env.SMOKE_EXECUTE_BUY === "1") {
      fail(
        "Live buy",
        "Wire HookitSwapRouter execute here when ready — left gated to avoid accidental spends",
      );
    }
    void wallet;
  } else {
    console.log("\n(Tip) Set SMOKE_PRIVATE_KEY for wallet-funded checks (test key only).");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

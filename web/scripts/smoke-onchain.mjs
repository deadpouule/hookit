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
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc =
  process.env.NEXT_PUBLIC_INK_RPC_URL ||
  process.env.INK_RPC_URL ||
  process.env.INK_RPC_URL_BACKUP ||
  "https://rpc-gel.inkonchain.com";

const CURRENT_FACTORY = getAddress("0xDCa9Ccee27Dc12256818dEFf316BA4B972b087a7");
const ENV_FACTORY = process.env.NEXT_PUBLIC_LAUNCH_FACTORY
  ? getAddress(process.env.NEXT_PUBLIC_LAUNCH_FACTORY)
  : null;
const FACTORY =
  process.env.SMOKE_FACTORY
    ? getAddress(process.env.SMOKE_FACTORY)
    : ENV_FACTORY || CURRENT_FACTORY;
const FACTORY_QUERY = getAddress(
  process.env.NEXT_PUBLIC_LAUNCH_FACTORY_QUERY ||
    "0xeB76E32818331FC4CbAF1033d4949c9Ee1d851f0",
);
const DIST = getAddress(
  process.env.NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR ||
    "0x2F904D2C2dC5dc536F41Cf99BCF0Ac6034187179",
);
const ROUTER = getAddress(
  process.env.NEXT_PUBLIC_HOOKIT_SWAP_ROUTER || "0x6889635F39c472802AbdE7Db791f2Ea48090091A",
);
const QUOTER = getAddress("0x3972C00f7ed4885e145823eb7C655375d275A1C5");
const STATE_VIEW = getAddress("0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990");
const ETH_USD_FEED = getAddress(
  process.env.SMOKE_ETH_USD_FEED || "0x4b286359a4e5739D414aD00D6A320F93fF2b6092", // WETH/USDt0 v3 TWAP wired into the factory
);
const DYNAMIC_FEE_FLAG = 0x800000;
const FLAG_DYNAMIC_FEES = 1n << 5n;

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

const routerAbi = parseAbi([
  "function swapExactIn((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint256 amountIn, uint256 minAmountOut, uint160 sqrtPriceLimitX96) payable returns (uint256 amountOut)",
]);
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function symbol() view returns (string)",
]);
const MIN_SQRT_PRICE = 4295128739n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
const sqrtLimit = (zeroForOne) => (zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n);

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

const SMOKE_ACCOUNT = "0x0000000000000000000000000000000000000001";

// Master pools with supply caps require the recipient in hookData (same as the UI).
function hookRecipientData(recipient) {
  return encodeAbiParameters([{ type: "address" }], [recipient]);
}

async function quoteBuy(key, amountIn = parseEther("0.001"), recipient = SMOKE_ACCOUNT) {
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
        hookData: hookRecipientData(recipient),
      },
    ],
    account: recipient,
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

  let dynamicTokens = [];
  if (count > 0n) {
    const page = await client.readContract({
      address: FACTORY_QUERY,
      abi: factoryAbi,
      functionName: "getLaunchPage",
      args: [1n, count],
    });
    const infos = page[0];
    const bitmasks = page[1];
    dynamicTokens = infos
      .map((info, index) => ({
        token: getAddress(info.token ?? info[0]),
        bitmask: bitmasks[index],
      }))
      .filter(({ bitmask }) => (bitmask & FLAG_DYNAMIC_FEES) !== 0n)
      .map(({ token }) => token);
  }

  // Live ETH/USD feed. The v3 TWAP feed reverts (e.g. "OLD" when the pool's observation
  // cardinality does not cover the window); the factory then falls back to its stored price.
  let liveUsd = 0;
  try {
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
    liveUsd = Number(rd[1]) / 10 ** Number(dec);
    if (liveUsd > 500 && liveUsd < 20_000) pass("ETH/USD feed live", `$${liveUsd.toFixed(2)}`);
    else fail("ETH/USD feed live", String(liveUsd));
  } catch (e) {
    const reason = e.shortMessage || String(e);
    fail(
      "ETH/USD feed live",
      /OLD/.test(reason)
        ? "TWAP feed reverted OLD — pool observation cardinality too low for the window; factory is on its fallback price"
        : reason,
    );
  }

  let factoryUsd = 0;
  try {
    const x18 = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "ethUsdPriceX18",
    });
    factoryUsd = Number(formatEther(x18));
    const drift = liveUsd > 0 ? Math.abs(factoryUsd - liveUsd) / liveUsd : 0;
    if (liveUsd === 0) {
      pass("Factory ethUsdPriceX18 (fallback)", `$${factoryUsd.toFixed(2)}`);
    } else if (drift > 0.15) {
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
  if (dynamicTokens.length === 0) {
    console.log("  · No dynamic-fee launch on the current factory to quote");
  }
  for (const token of dynamicTokens) {
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

  // Optional live buy / sell with a test key (never a hot wallet).
  const pk = process.env.SMOKE_PRIVATE_KEY;
  if (pk) {
    const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
    const wallet = createWalletClient({ account, chain: ink, transport: http(rpc) });
    const bal = await client.getBalance({ address: account.address });
    pass("Smoke wallet funded", `${account.address} bal=${formatEther(bal)} ETH`);

    const target = process.env.SMOKE_TOKEN ? getAddress(process.env.SMOKE_TOKEN) : dynamicTokens[0];
    const buyEth = process.env.SMOKE_BUY_ETH || "0.0001";
    const execBuy = process.env.SMOKE_EXECUTE_BUY === "1";
    const execSell = process.env.SMOKE_EXECUTE_SELL === "1";
    if (!execBuy && !execSell) {
      console.log(
        `\n(Optional live swap skipped — SMOKE_EXECUTE_BUY=1 buys ${buyEth} ETH of ${target ?? "?"}, SMOKE_EXECUTE_SELL=1 sells the balance back)`,
      );
    } else if (!target) {
      fail("Live swap", "no target token (set SMOKE_TOKEN)");
    } else {
      const launchId = await client.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "tokenLaunchId",
        args: [target],
      });
      const key = asKey(
        await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "poolKeyOf", args: [launchId] }),
      );
      const symbol = await client.readContract({ address: target, abi: erc20Abi, functionName: "symbol" });
      const buyZeroForOne = key.currency0.toLowerCase() === zeroAddress;

      if (execBuy) {
        try {
          const amountIn = parseEther(buyEth);
          const quoted = await quoteBuy(key, amountIn, account.address);
          const minOut = (quoted * 97n) / 100n;
          const before = await client.readContract({ address: target, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
          const hash = await wallet.writeContract({
            address: ROUTER,
            abi: routerAbi,
            functionName: "swapExactIn",
            args: [key, buyZeroForOne, amountIn, minOut, sqrtLimit(buyZeroForOne)],
            value: amountIn,
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          const after = await client.readContract({ address: target, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
          const got = after - before;
          if (receipt.status === "success" && got > 0n) {
            pass(`Live buy ${symbol}`, `${buyEth} ETH -> ${formatUnits(got, 18)} ${symbol} (quote ${formatUnits(quoted, 18)}) tx=${hash}`);
          } else {
            fail(`Live buy ${symbol}`, `status=${receipt.status} received=${got} tx=${hash}`);
          }
        } catch (e) {
          fail(`Live buy ${symbol}`, e.shortMessage || String(e));
        }
      }

      if (execSell) {
        try {
          const tokenBal = await client.readContract({ address: target, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
          if (tokenBal === 0n) throw new Error("no token balance to sell");
          const allowance = await client.readContract({ address: target, abi: erc20Abi, functionName: "allowance", args: [account.address, ROUTER] });
          if (allowance < tokenBal) {
            const approveHash = await wallet.writeContract({ address: target, abi: erc20Abi, functionName: "approve", args: [ROUTER, tokenBal] });
            await client.waitForTransactionReceipt({ hash: approveHash });
          }
          const ethBefore = await client.getBalance({ address: account.address });
          const sellZeroForOne = !buyZeroForOne;
          const hash = await wallet.writeContract({
            address: ROUTER,
            abi: routerAbi,
            functionName: "swapExactIn",
            args: [key, sellZeroForOne, tokenBal, 1n, sqrtLimit(sellZeroForOne)],
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          const ethAfter = await client.getBalance({ address: account.address });
          const left = await client.readContract({ address: target, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
          if (receipt.status === "success" && left === 0n) {
            pass(`Live sell ${symbol}`, `${formatUnits(tokenBal, 18)} ${symbol} -> +${formatEther(ethAfter - ethBefore)} ETH net of gas tx=${hash}`);
          } else {
            fail(`Live sell ${symbol}`, `status=${receipt.status} left=${left} tx=${hash}`);
          }
        } catch (e) {
          fail(`Live sell ${symbol}`, e.shortMessage || String(e));
        }
      }
    }
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

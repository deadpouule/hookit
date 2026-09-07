/**
 * Daily protocol fee keeper (Ink).
 * Routes pending fees: 20% opsTreasury / 80% flywheel, then optional TWAP HTST buyback+burn.
 *
 * Run (from indexer dir):
 *   npm run fee-keeper
 *   # or: /opt/hookit/deploy/linode/fee-keeper/run.sh
 *
 * Env (from /opt/hookit/.env):
 *   INK_RPC_URL, FEE_KEEPER_PRIVATE_KEY (or PRIVATE_KEY)
 *   PROTOCOL_DISTRIBUTOR, HKIT_BUYBACK (defaults = live RedeployHookitInk)
 *   FEE_KEEPER_BUYBACK=true|false
 *   FEE_KEEPER_BUYBACK_MAX_WEI — cap ETH spent per run (TWAP slice; default 0.05 ether)
 *   FEE_KEEPER_BUYBACK_MIN_WEI — skip buyback below this (default 1e12 wei)
 *   FEE_KEEPER_MIN_USDG_OUT — stock→USDG slippage floor (default 0)
 *   FEE_KEEPER_DRY_RUN=true — log only
 */
import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const INK = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"] } },
} as const;

const DEFAULT_DISTRIBUTOR = "0x4149509d2293a61cb199E17227740eEBFADd30c6" as Address;
const DEFAULT_BUYBACK = "0x3D68Cc2C71f3b146295c8D9C1A82B3591f24fcCB" as Address;

/** Quotrons wStocks that may accrue protocol pending on multi / stock-quoted launches. */
const QUOTRON_STOCKS: Address[] = [
  "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f", // wAAPLx
  "0x910cabdE3EBa7Fc1Ce64fD14bD680b9f60fA0F90", // wAMZNx
  "0xf8c5308F80E459bb53d9EbE689854d9cBb2Caa6f", // wGOOGLx
  "0xc6639026a3a862cd4fcbae3f67cB2D25A2959d37", // wMCDx
  "0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB", // wMSTRx
  "0x7d87fD6A379714194a797c0bBB8B40c30D250856", // wNFLXx
  "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5", // wNVDAx
  "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540", // wSPYx
  "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171", // wTSLAx
];

const distributorAbi = parseAbi([
  "function pending(address currency) view returns (uint256)",
  "function buybackEth() view returns (uint256)",
  "function feeRail() view returns (address)",
  "function opsTreasury() view returns (address)",
  "function distribute(address currency)",
  "function distributeToBuyback(address currency, uint256 minUsdgOut)",
  "function flushBuybackEth() returns (uint256)",
]);

const feeRailAbi = parseAbi(["function usdg() view returns (address)"]);

const buybackAbi = parseAbi([
  "function execute(uint256 ethAmount, uint256 minTokensOut) returns (uint256 tokensBurned)",
  "function configured() view returns (bool)",
]);

function envAddr(name: string, fallback: Address): Address {
  const v = process.env[name]?.trim();
  if (v && isAddress(v)) return v as Address;
  return fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function envBig(name: string, fallback: bigint): bigint {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  return BigInt(v);
}

function pk(): Hex {
  const raw = (process.env.FEE_KEEPER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  if (!raw) throw new Error("Set FEE_KEEPER_PRIVATE_KEY (or PRIVATE_KEY) for the fee keeper wallet");
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

async function main() {
  const rpc = process.env.INK_RPC_URL ?? process.env.INK_RPC_URL_BACKUP ?? "https://rpc-gel.inkonchain.com";
  const distributor = envAddr("PROTOCOL_DISTRIBUTOR", envAddr("DISTRIBUTOR", DEFAULT_DISTRIBUTOR));
  const buyback = envAddr("HKIT_BUYBACK", DEFAULT_BUYBACK);
  const minUsdgOut = envBig("FEE_KEEPER_MIN_USDG_OUT", 0n);
  const doBuyback = envBool("FEE_KEEPER_BUYBACK", true);
  const buybackMax = envBig("FEE_KEEPER_BUYBACK_MAX_WEI", 50_000_000_000_000_000n); // 0.05 ETH / day
  const buybackMin = envBig("FEE_KEEPER_BUYBACK_MIN_WEI", 1_000_000_000_000n); // 1e12 wei
  const dryRun = envBool("FEE_KEEPER_DRY_RUN", false);

  const account = privateKeyToAccount(pk());
  const publicClient = createPublicClient({ chain: INK, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: INK, transport: http(rpc) });

  const chainId = await publicClient.getChainId();
  if (chainId !== 57073) throw new Error(`Expected Ink 57073, got ${chainId}`);

  const ops = await publicClient.readContract({
    address: distributor,
    abi: distributorAbi,
    functionName: "opsTreasury",
  });
  const rail = await publicClient.readContract({
    address: distributor,
    abi: distributorAbi,
    functionName: "feeRail",
  });
  let usdg: Address | null = null;
  if (rail !== zeroAddress) {
    usdg = await publicClient.readContract({ address: rail, abi: feeRailAbi, functionName: "usdg" });
  }

  console.log("[fee-keeper] distributor", distributor);
  console.log("[fee-keeper] opsTreasury", ops);
  console.log("[fee-keeper] buyback", buyback);
  console.log("[fee-keeper] keeper", account.address);
  console.log("[fee-keeper] dryRun", dryRun);

  async function pendingOf(currency: Address): Promise<bigint> {
    return publicClient.readContract({
      address: distributor,
      abi: distributorAbi,
      functionName: "pending",
      args: [currency],
    });
  }

  async function waitOk(label: string, hash: Hash) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${label} reverted (${hash})`);
    console.log(`[fee-keeper] ok ${hash}`);
  }

  // 1) ETH pending -> 20% ops / 80% buybackEth
  const ethPending = await pendingOf(zeroAddress);
  if (ethPending > 0n) {
    console.log(`[fee-keeper] pending ETH ${formatEther(ethPending)}`);
    if (!dryRun) {
      const hash = await walletClient.writeContract({
        address: distributor,
        abi: distributorAbi,
        functionName: "distribute",
        args: [zeroAddress],
      });
      await waitOk("distribute ETH", hash);
    }
  } else {
    console.log("[fee-keeper] pending ETH 0");
  }

  // 2) Quotrons wStocks -> USDG rail -> 20/80
  for (const stock of QUOTRON_STOCKS) {
    const amt = await pendingOf(stock);
    if (amt === 0n) continue;
    console.log(`[fee-keeper] pending stock ${stock} ${amt}`);
    if (dryRun) continue;
    try {
      const hash = await walletClient.writeContract({
        address: distributor,
        abi: distributorAbi,
        functionName: "distributeToBuyback",
        args: [stock, minUsdgOut],
      });
      await waitOk(`distributeToBuyback ${stock}`, hash);
    } catch (e) {
      console.error(`[fee-keeper] stock flush failed ${stock}`, e);
    }
  }

  // 3) Native USDG pending
  if (usdg) {
    const u = await pendingOf(usdg);
    if (u > 0n) {
      console.log(`[fee-keeper] pending USDG ${u}`);
      if (!dryRun) {
        const hash = await walletClient.writeContract({
          address: distributor,
          abi: distributorAbi,
          functionName: "distribute",
          args: [usdg],
        });
        await waitOk("distribute USDG", hash);
      }
    }
  }

  // 4) TWAP slice of buybackEth -> buy+burn HTST
  if (doBuyback) {
    if (!dryRun) {
      const flushHash = await walletClient.writeContract({
        address: distributor,
        abi: distributorAbi,
        functionName: "flushBuybackEth",
      });
      await waitOk("flushBuybackEth", flushHash);
    }
    const pot = await publicClient.readContract({
      address: distributor,
      abi: distributorAbi,
      functionName: "buybackEth",
    });
    console.log(`[fee-keeper] buybackEth pot ${formatEther(pot)} ETH`);
    if (pot < buybackMin) {
      console.log("[fee-keeper] buyback skipped (below FEE_KEEPER_BUYBACK_MIN_WEI)");
    } else {
      const configured = await publicClient.readContract({
        address: buyback,
        abi: buybackAbi,
        functionName: "configured",
      });
      if (!configured) throw new Error("HkitBuyback not configured");
      const slice = pot < buybackMax ? pot : buybackMax;
      console.log(`[fee-keeper] buyback TWAP slice ${formatEther(slice)} ETH`);
      if (!dryRun) {
        const hash = await walletClient.writeContract({
          address: buyback,
          abi: buybackAbi,
          functionName: "execute",
          args: [slice, 0n],
        });
        await waitOk("execute buyback", hash);
      }
    }
  } else {
    console.log("[fee-keeper] FEE_KEEPER_BUYBACK=false - skip HTST buyback");
  }

  console.log("[fee-keeper] FEE_KEEPER_OK");
}

main().catch((err) => {
  console.error("[fee-keeper] FAILED", err);
  process.exit(1);
});

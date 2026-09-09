/**
 * Multi-pair price arb keeper (Ink).
 *
 * Buys the launch token on the cheapest USD market and sells on the richest via
 * MultiPairArbExecutor. The live MasterLaunchHook does not expose this path until
 * the next factory/hook deploy — leave every flag off until then.
 *
 * Run (from indexer dir):
 *   npm run arb-keeper
 *
 * Env:
 *   MULTI_PAIR_ARB=false            master switch (default off — no RPC)
 *   MULTI_PAIR_ARB_DRY_RUN=true     log preview only (default true even when enabled)
 *   MULTI_PAIR_ARB_EXECUTOR         executor address (required when enabled)
 *   MULTI_PAIR_ARB_LAUNCH_IDS       comma-separated launch ids
 *   INK_RPC_URL, FEE_KEEPER_PRIVATE_KEY (or PRIVATE_KEY) — only used when enabled
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

const INK = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"] } },
} as const;

const executorAbi = parseAbi([
  "function paused() view returns (bool)",
  "function maxClipUsdX18() view returns (uint256)",
  "function minDeviationBps() view returns (uint16)",
  "function hook() view returns (address)",
  "function preview(uint256 launchId) view returns ((uint8 marketCount, uint8 cheapIndex, uint8 richIndex, uint256 cheapUsdX18, uint256 richUsdX18, uint256 deviationBps, uint256 clipQuoteWei, bool executable))",
  "function execute(uint256 launchId) returns (uint256 clipQuoteWei, uint256 tokenSold, uint256 quoteOut)",
]);

const hookAbi = parseAbi([
  "function arbActive() view returns (bool)",
  "function arbExecutor() view returns (address)",
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

function envLaunchIds(): bigint[] {
  const raw = process.env.MULTI_PAIR_ARB_LAUNCH_IDS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s));
}

function pk(required: boolean): Hex {
  const raw = (process.env.FEE_KEEPER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "").trim();
  if (!raw) {
    if (required) throw new Error("Set FEE_KEEPER_PRIVATE_KEY (or PRIVATE_KEY) for the arb keeper wallet");
    return `0x${"00".repeat(31)}01` as Hex;
  }
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

async function main() {
  const enabled = envBool("MULTI_PAIR_ARB", false);
  if (!enabled) {
    console.log("[arb-keeper] disabled (MULTI_PAIR_ARB=false). No RPC calls.");
    return;
  }

  const dryRun = envBool("MULTI_PAIR_ARB_DRY_RUN", true);
  const executor = envAddr("MULTI_PAIR_ARB_EXECUTOR");
  if (!executor) {
    throw new Error("Set MULTI_PAIR_ARB_EXECUTOR when MULTI_PAIR_ARB=true");
  }
  const launchIds = envLaunchIds();
  if (launchIds.length === 0) {
    console.log("[arb-keeper] no MULTI_PAIR_ARB_LAUNCH_IDS; nothing to do");
    return;
  }

  const rpc = process.env.INK_RPC_URL ?? process.env.INK_RPC_URL_BACKUP ?? "https://rpc-gel.inkonchain.com";
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
  console.log("[arb-keeper] hook", hook);
  console.log("[arb-keeper] paused", paused, "maxClipUsd", maxClip.toString(), "minDeviationBps", minDev);
  console.log("[arb-keeper] arbActive", arbActive, "arbExecutor", arbExecutor);
  console.log("[arb-keeper] dryRun", dryRun, "keeper", hasKeeperKey ? account.address : "not configured (dry-run)");

  for (const launchId of launchIds) {
    const preview = await publicClient.readContract({
      address: executor,
      abi: executorAbi,
      functionName: "preview",
      args: [launchId],
    });
    const [marketCount, cheapIndex, richIndex, cheapUsd, richUsd, deviationBps, clipQuoteWei, executable] = preview;
    console.log(
      `[arb-keeper] launch ${launchId} markets=${marketCount} cheap=${cheapIndex} rich=${richIndex}` +
        ` cheapUsd=${cheapUsd} richUsd=${richUsd} devBps=${deviationBps} clip=${clipQuoteWei} executable=${executable}`,
    );
    if (!executable) continue;
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
  }

  console.log("[arb-keeper] ARB_KEEPER_OK");
}

main().catch((err) => {
  console.error("[arb-keeper] FAILED", err);
  process.exit(1);
});

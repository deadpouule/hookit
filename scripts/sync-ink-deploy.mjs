#!/usr/bin/env node
/**
 * Sync Hookit UI + indexer env from a Foundry broadcast after Ink redeploy.
 *
 * Usage (from repo root):
 *   node scripts/sync-ink-deploy.mjs
 *   node scripts/sync-ink-deploy.mjs --dry-run
 *   node scripts/sync-ink-deploy.mjs --write-env
 *   node scripts/sync-ink-deploy.mjs --reset-indexer
 *   node scripts/sync-ink-deploy.mjs --broadcast broadcast/RedeployHookitInk.s.sol/57073/run-latest.json
 *
 * Writes:
 *   - deploy/ink/addresses.json   (canonical)
 *   - deploy/ink/env.ink.example
 *   - indexer/.env.example
 *   - .env.example (commented factory lines)
 * With --write-env (local only, never committed secrets):
 *   - .env, web/.env.local, web/.env.production.local, indexer/.env
 * With --reset-indexer:
 *   - deletes indexer/data/* so the poller restarts from INDEXER_START_BLOCK
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CHAIN_ID = 57073;

const CONTRACT_KEYS = [
  "LaunchFactoryLib",
  "LaunchDevBuyLib",
  "LaunchTokenDeployLib",
  "FloorVault",
  "FeeEscrow",
  "ProtocolRevenueDistributor",
  "BuybackVault",
  "HolderAirdropVault",
  "MasterLaunchHook",
  "LaunchFactory",
  "LaunchFactoryQuery",
  "GraduatedFeeHook",
  "BondingLaunchFactory",
  "HookitSwapRouter",
  "V4ClaimsRedeemer",
  "FeeEthRail",
  "HkitBuyback",
];

const ENV_MAP = {
  LAUNCH_FACTORY: "LaunchFactory",
  LAUNCH_FACTORY_QUERY: "LaunchFactoryQuery",
  BONDING_FACTORY: "BondingLaunchFactory",
  HOOKIT_SWAP_ROUTER: "HookitSwapRouter",
  CLAIMS_REDEEMER: "V4ClaimsRedeemer",
  MASTER_LAUNCH_HOOK: "MasterLaunchHook",
  GRADUATED_FEE_HOOK: "GraduatedFeeHook",
  FLOOR_VAULT: "FloorVault",
  FEE_ESCROW: "FeeEscrow",
  DISTRIBUTOR: "ProtocolRevenueDistributor",
  PROTOCOL_DISTRIBUTOR: "ProtocolRevenueDistributor",
  BUYBACK_VAULT: "BuybackVault",
  HOLDER_AIRDROP_VAULT: "HolderAirdropVault",
  FEE_ETH_RAIL: "FeeEthRail",
  HKIT_BUYBACK: "HkitBuyback",
  NATIVE_TOKEN: "NativeToken",
  INDEXER_START_BLOCK: "_startBlock",
};

const NEXT_PUBLIC_MAP = {
  NEXT_PUBLIC_LAUNCH_FACTORY: "LaunchFactory",
  NEXT_PUBLIC_LAUNCH_FACTORY_QUERY: "LaunchFactoryQuery",
  NEXT_PUBLIC_BONDING_FACTORY: "BondingLaunchFactory",
  NEXT_PUBLIC_HOOKIT_SWAP_ROUTER: "HookitSwapRouter",
  NEXT_PUBLIC_CLAIMS_REDEEMER: "V4ClaimsRedeemer",
  NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR: "ProtocolRevenueDistributor",
  NEXT_PUBLIC_HKIT_BUYBACK: "HkitBuyback",
  NEXT_PUBLIC_NATIVE_TOKEN: "NativeToken",
};

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    writeEnv: false,
    resetIndexer: false,
    broadcast: join(ROOT, "broadcast/RedeployHookitInk.s.sol/57073/run-latest.json"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--write-env") opts.writeEnv = true;
    else if (a === "--reset-indexer") opts.resetIndexer = true;
    else if (a === "--broadcast") opts.broadcast = resolve(argv[++i] ?? "");
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/sync-ink-deploy.mjs [--dry-run] [--write-env] [--reset-indexer] [--broadcast PATH]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return opts;
}

function lower(addr) {
  return String(addr).toLowerCase();
}

function parseBlock(bn) {
  if (bn == null) return null;
  if (typeof bn === "number") return bn;
  if (typeof bn === "string") return bn.startsWith("0x") ? Number.parseInt(bn, 16) : Number(bn);
  return null;
}

function loadBroadcast(path) {
  if (!existsSync(path)) throw new Error(`Broadcast not found: ${path}`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const byHash = new Map((raw.transactions ?? []).map((t) => [t.hash, t]));
  const creates = new Map();
  let factoryCreateBlock = null;
  let deployer = null;

  for (const tx of raw.transactions ?? []) {
    const type = tx.transactionType;
    if (type !== "CREATE" && type !== "CREATE2") continue;
    const name = tx.contractName;
    const addr = tx.contractAddress;
    if (!name || !addr) continue;
    creates.set(name, lower(addr));
    if (!deployer && tx.transaction?.from) deployer = lower(tx.transaction.from);
  }

  for (const receipt of raw.receipts ?? []) {
    const tx = byHash.get(receipt.transactionHash);
    if (!tx) continue;
    if (tx.contractName === "LaunchFactory" && (tx.transactionType === "CREATE" || tx.transactionType === "CREATE2")) {
      const block = parseBlock(receipt.blockNumber);
      if (block != null && (factoryCreateBlock == null || block < factoryCreateBlock)) {
        factoryCreateBlock = block;
      }
    }
  }

  // Native token is created via fair-launch CALL, not a named CREATE — reuse existing if present.
  const prevPath = join(ROOT, "deploy/ink/addresses.json");
  let prevNative = null;
  let prevNativeMeta = null;
  let prevIndexerStartBlock = null;
  let previousContracts = null;
  if (existsSync(prevPath)) {
    try {
      const prev = JSON.parse(readFileSync(prevPath, "utf8"));
      prevNative = prev.contracts?.NativeToken ?? prev.nativeToken?.address ?? null;
      prevNativeMeta = prev.nativeToken ?? null;
      prevIndexerStartBlock = parseBlock(prev.indexer?.startBlock);
      previousContracts = {
        LaunchFactories: [
          prev.contracts?.LaunchFactory,
          ...(prev.previousContracts?.LaunchFactories ?? []),
        ].filter(Boolean),
        BondingLaunchFactories: [
          prev.contracts?.BondingLaunchFactory,
          ...(prev.previousContracts?.BondingLaunchFactories ?? []),
        ].filter(Boolean),
        ProtocolRevenueDistributors: [
          prev.contracts?.ProtocolRevenueDistributor,
          ...(prev.previousContracts?.ProtocolRevenueDistributors ?? []),
        ].filter(Boolean),
        HkitBuybacks: [
          prev.contracts?.HkitBuyback,
          ...(prev.previousContracts?.HkitBuybacks ?? []),
        ].filter(Boolean),
      };
    } catch {
      /* ignore */
    }
  }
  if (prevNative) creates.set("NativeToken", lower(prevNative));
  if (previousContracts) {
    const currentByGroup = {
      LaunchFactories: creates.get("LaunchFactory"),
      BondingLaunchFactories: creates.get("BondingLaunchFactory"),
      ProtocolRevenueDistributors: creates.get("ProtocolRevenueDistributor"),
      HkitBuybacks: creates.get("HkitBuyback"),
    };
    for (const [group, current] of Object.entries(currentByGroup)) {
      previousContracts[group] = [
        ...new Set(
          previousContracts[group]
            .map(lower)
            .filter((address) => address && address !== current),
        ),
      ];
    }
  }

  return {
    creates,
    factoryCreateBlock,
    deployer,
    prevNativeMeta,
    prevIndexerStartBlock,
    previousContracts,
    path,
  };
}

/** Libs may be reused across redeploys (no CREATE in this broadcast) — carry from prior addresses.json. */
const OPTIONAL_CARRY = new Set(["LaunchFactoryLib", "LaunchDevBuyLib", "LaunchTokenDeployLib"]);

function requireContracts(creates) {
  const prevPath = join(ROOT, "deploy/ink/addresses.json");
  if (existsSync(prevPath)) {
    try {
      const prev = JSON.parse(readFileSync(prevPath, "utf8"));
      for (const key of OPTIONAL_CARRY) {
        if (!creates.has(key) && prev.contracts?.[key]) {
          creates.set(key, lower(prev.contracts[key]));
        }
      }
    } catch {
      /* ignore */
    }
  }
  const missing = CONTRACT_KEYS.filter((k) => !creates.has(k));
  if (missing.length) {
    throw new Error(`Broadcast missing CREATE contracts: ${missing.join(", ")}`);
  }
}

function buildAddresses(
  creates,
  deployBlock,
  indexerStartBlock,
  deployer,
  prevNativeMeta,
  previousContracts,
) {
  const native = creates.get("NativeToken");
  const today = new Date().toISOString().slice(0, 10);
  return {
    chainId: CHAIN_ID,
    network: "Ink mainnet",
    deployedAt: today,
    deployBlock,
    deployer: deployer ?? "",
    contracts: Object.fromEntries([
      ...CONTRACT_KEYS.map((k) => [k, creates.get(k)]),
      ...(native ? [["NativeToken", native]] : []),
    ]),
    previousContracts,
    nativeToken: native
      ? {
          name: prevNativeMeta?.name ?? "HOOKTEST",
          symbol: prevNativeMeta?.symbol ?? "HTST",
          address: native,
        }
      : undefined,
    indexer: {
      startBlock: indexerStartBlock,
      url: "https://indexer.hookit.fun",
    },
    notes: [
      `Synced from forge broadcast by scripts/sync-ink-deploy.mjs on ${today}.`,
      ...(prevNativeMeta
        ? ["Existing native token carried forward; fair launch was skipped for this redeploy."]
        : []),
      "Indexer must retain its store and watch current plus previous Master factories; do not reset.",
      "customHookAllowlistEnabled expected true after harden.",
    ],
  };
}

function upsertEnvLines(text, updates) {
  let out = text.endsWith("\n") || text.length === 0 ? text : `${text}\n`;
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") continue;
    const line = `${key}=${value}`;
    const re = new RegExp(`^#?\\s*${key}=.*$`, "m");
    if (re.test(out)) {
      out = out.replace(re, line);
    } else {
      out = `${out.trimEnd()}\n${line}\n`;
    }
  }
  return out;
}

function upsertCommentedEnv(text, updates) {
  let out = text.endsWith("\n") || text.length === 0 ? text : `${text}\n`;
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") continue;
    const line = `# ${key}=${value}`;
    const re = new RegExp(`^#?\\s*${key}=.*$`, "m");
    if (re.test(out)) out = out.replace(re, line);
    else out = `${out.trimEnd()}\n${line}\n`;
  }
  return out;
}

function writeText(path, contents, dryRun) {
  if (dryRun) {
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 8);
    console.log(`[dry-run] would write ${path} (${contents.length} bytes, sha ${hash})`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  console.log(`wrote ${path}`);
}

function resolveValue(creates, startBlock, key) {
  if (key === "_startBlock") return String(startBlock);
  return creates.get(key);
}

function buildEnvBundle(creates, indexerStartBlock) {
  const server = {};
  for (const [envKey, contractKey] of Object.entries(ENV_MAP)) {
    const v = resolveValue(creates, indexerStartBlock, contractKey);
    if (v) server[envKey] = v;
  }
  const next = {};
  for (const [envKey, contractKey] of Object.entries(NEXT_PUBLIC_MAP)) {
    const v = resolveValue(creates, indexerStartBlock, contractKey);
    if (v) next[envKey] = v;
  }
  return { server, next };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const {
    creates,
    factoryCreateBlock,
    deployer,
    prevNativeMeta,
    prevIndexerStartBlock,
    previousContracts,
    path,
  } = loadBroadcast(opts.broadcast);
  requireContracts(creates);

  if (factoryCreateBlock == null) {
    throw new Error("Could not resolve LaunchFactory CREATE block from receipts");
  }

  const indexerStartBlock =
    prevIndexerStartBlock == null
      ? factoryCreateBlock
      : Math.min(prevIndexerStartBlock, factoryCreateBlock);
  const addresses = buildAddresses(
    creates,
    factoryCreateBlock,
    indexerStartBlock,
    deployer,
    prevNativeMeta,
    previousContracts,
  );
  const { server, next } = buildEnvBundle(creates, indexerStartBlock);
  const indexerFactoryList = [
    server.LAUNCH_FACTORY,
    ...(previousContracts?.LaunchFactories ?? []),
  ].filter(Boolean).join(",");

  console.log(`broadcast: ${path}`);
  console.log(`LaunchFactory: ${creates.get("LaunchFactory")} @ block ${factoryCreateBlock}`);
  console.log(`FeeEthRail:    ${creates.get("FeeEthRail")}`);
  if (creates.get("NativeToken")) console.log(`NativeToken:   ${creates.get("NativeToken")} (carried from previous addresses.json)`);

  writeText(
    join(ROOT, "deploy/ink/addresses.json"),
    `${JSON.stringify(addresses, null, 2)}\n`,
    opts.dryRun,
  );

  // deploy/ink/env.ink.example
  {
    const p = join(ROOT, "deploy/ink/env.ink.example");
    const base = existsSync(p)
      ? readFileSync(p, "utf8")
      : `# Copy to repo root .env for Ink scripts. Never commit secrets.\n\nINK_RPC_URL=https://rpc-gel.inkonchain.com\nPRIVATE_KEY=\n`;
    const header = `# --- Ink mainnet (${CHAIN_ID}) — synced ${addresses.deployedAt}, block ${factoryCreateBlock} ---`;
    let text = base.replace(/^# --- Ink mainnet.*$/m, header);
    if (!/^# --- Ink mainnet/m.test(text)) {
      text = `${text.trimEnd()}\n\n${header}\n`;
    }
    writeText(p, upsertEnvLines(text, server), opts.dryRun);
  }

  // indexer/.env.example
  {
    const p = join(ROOT, "indexer/.env.example");
    const base = existsSync(p) ? readFileSync(p, "utf8") : "HOOKIT_CHAIN=ink\n";
    writeText(
      p,
      upsertEnvLines(base, {
        LAUNCH_FACTORY: indexerFactoryList,
        BONDING_FACTORY: server.BONDING_FACTORY,
        INDEXER_START_BLOCK: server.INDEXER_START_BLOCK,
      }),
      opts.dryRun,
    );
  }

  // web/.env.example
  {
    const p = join(ROOT, "web/.env.example");
    if (existsSync(p)) {
      const base = readFileSync(p, "utf8");
      writeText(p, upsertEnvLines(base, next), opts.dryRun);
    }
  }

  // root .env.example — keep secrets commented
  {
    const p = join(ROOT, ".env.example");
    if (existsSync(p)) {
      const base = readFileSync(p, "utf8");
      writeText(
        p,
        upsertCommentedEnv(base, {
          NEXT_PUBLIC_LAUNCH_FACTORY: next.NEXT_PUBLIC_LAUNCH_FACTORY,
          NEXT_PUBLIC_BONDING_FACTORY: next.NEXT_PUBLIC_BONDING_FACTORY,
          NEXT_PUBLIC_HOOKIT_SWAP_ROUTER: next.NEXT_PUBLIC_HOOKIT_SWAP_ROUTER,
          LAUNCH_FACTORY: server.LAUNCH_FACTORY,
          BONDING_FACTORY: server.BONDING_FACTORY,
          INDEXER_START_BLOCK: server.INDEXER_START_BLOCK,
        }),
        opts.dryRun,
      );
    }
  }

  if (opts.writeEnv) {
    const mergeTargets = [
      join(ROOT, ".env"),
      join(ROOT, "web/.env.local"),
      join(ROOT, "web/.env.production.local"),
      join(ROOT, "indexer/.env"),
    ];
    for (const p of mergeTargets) {
      if (!existsSync(p)) {
        console.log(`skip missing ${p}`);
        continue;
      }
      const base = readFileSync(p, "utf8");
      const isWeb = p.includes(`${join("web", "")}`) || p.includes("web/");
      const isIndexer = p.includes(`${join("indexer", "")}`) || p.includes("indexer/");
      const updates = isWeb
        ? { ...next, INDEXER_START_BLOCK: server.INDEXER_START_BLOCK }
        : {
            ...server,
            ...next,
            ...(isIndexer ? { LAUNCH_FACTORY: indexerFactoryList } : {}),
          };
      writeText(p, upsertEnvLines(base, updates), opts.dryRun);
    }
  }

  if (opts.resetIndexer) {
    const dataDir = join(ROOT, "indexer/data");
    if (!existsSync(dataDir)) {
      console.log("no indexer/data to reset");
    } else if (opts.dryRun) {
      console.log(`[dry-run] would wipe ${dataDir}`);
    } else {
      for (const name of readdirSync(dataDir)) {
        rmSync(join(dataDir, name), { recursive: true, force: true });
      }
      console.log(`reset ${dataDir}`);
    }
  }

  console.log("\nNext:");
  console.log("  1. Review deploy/ink/addresses.json");
  console.log("  2. node scripts/sync-ink-deploy.mjs --write-env   # patch local .env files");
  console.log("  3. Update Vercel / Linode env to match, then redeploy web + restart indexer");
  console.log("  4. Full factory cutover: --reset-indexer (wipes local indexer store)");
}

main();

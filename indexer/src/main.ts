import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.js";
import { createClient, tick } from "./poller.js";
import { startApi } from "./api.js";
import { Store } from "./store.js";

/** Load indexer/.env into process.env (no dotenv dependency). */
function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

async function main() {
  const cmd = process.argv[2] ?? "serve";
  const cfg = loadConfig();
  const store = new Store(cfg.dataDir, cfg.chainId, cfg.excludeAddresses);
  const client = createClient(cfg);

  console.log(`[indexer] chain=${cfg.chainId} rpc=${cfg.rpcUrl}`);
  console.log(`[indexer] factory=${cfg.launchFactory ?? "(unset)"} bonding=${cfg.bondingFactory ?? "(unset)"}`);
  console.log(`[indexer] data=${store.path} cursor=${store.data.cursor} confirmations=${cfg.confirmations}`);

  if (!cfg.launchFactory && !cfg.bondingFactory) {
    console.warn("[indexer] WARN: set LAUNCH_FACTORY and/or BONDING_FACTORY");
  }

  const runTick = async () => {
    try {
      const n = await tick(client, store, cfg);
      store.setPollError(undefined);
      if (n > 0) console.log(`[indexer] +${n} blocks → cursor ${store.data.cursor}`);
      return n;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.setPollError(msg);
      store.save();
      console.error("[indexer] poll error", err);
      throw err;
    }
  };

  if (cmd === "tick" || cmd === "poll-once") {
    const n = await runTick();
    console.log(`[indexer] processed ~${n} blocks → cursor ${store.data.cursor}`);
    return;
  }

  if (cmd === "poll") {
    for (;;) {
      try {
        await runTick();
      } catch {
        /* logged */
      }
      await new Promise((r) => setTimeout(r, cfg.pollMs));
    }
  }

  if (cmd === "serve") {
    startApi(store, cfg, () => client.getBlockNumber());
    for (;;) {
      try {
        await runTick();
      } catch {
        /* logged */
      }
      await new Promise((r) => setTimeout(r, cfg.pollMs));
    }
  }

  console.error(`Unknown command: ${cmd}. Use serve | poll | tick`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

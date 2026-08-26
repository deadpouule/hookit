import { loadConfig } from "./config.js";
import { createClient, tick } from "./poller.js";
import { startApi } from "./api.js";
import { Store } from "./store.js";

async function main() {
  const cmd = process.argv[2] ?? "serve";
  const cfg = loadConfig();
  const store = new Store(cfg.dataDir, cfg.chainId);
  const client = createClient(cfg);

  console.log(`[indexer] chain=${cfg.chainId} rpc=${cfg.rpcUrl}`);
  console.log(`[indexer] factory=${cfg.launchFactory ?? "(unset)"} bonding=${cfg.bondingFactory ?? "(unset)"}`);
  console.log(`[indexer] data=${store.path} cursor=${store.data.cursor}`);

  if (!cfg.launchFactory && !cfg.bondingFactory) {
    console.warn("[indexer] WARN: set LAUNCH_FACTORY and/or BONDING_FACTORY");
  }

  if (cmd === "tick" || cmd === "poll-once") {
    const n = await tick(client, store, cfg);
    console.log(`[indexer] processed ~${n} blocks → cursor ${store.data.cursor}`);
    return;
  }

  if (cmd === "poll") {
    for (;;) {
      try {
        const n = await tick(client, store, cfg);
        if (n > 0) console.log(`[indexer] +${n} blocks → cursor ${store.data.cursor}`);
      } catch (err) {
        console.error("[indexer] poll error", err);
      }
      await new Promise((r) => setTimeout(r, cfg.pollMs));
    }
  }

  if (cmd === "serve") {
    startApi(store, cfg);
    const loop = async () => {
      for (;;) {
        try {
          const n = await tick(client, store, cfg);
          if (n > 0) console.log(`[indexer] +${n} blocks → cursor ${store.data.cursor}`);
        } catch (err) {
          console.error("[indexer] poll error", err);
        }
        await new Promise((r) => setTimeout(r, cfg.pollMs));
      }
    };
    void loop();
    return;
  }

  console.error(`Unknown command: ${cmd}. Use serve | poll | tick`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

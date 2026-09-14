import assert from "node:assert/strict";
import { test } from "node:test";

import { masterDevBuyCapPct, MAX_DEV_BUY_SUPPLY_PCT, resolveDevBuyQuoteWei } from "./dev-buy-launch";
import { DEFAULT_LAUNCH_STATE } from "./constants";

const zero = "0x0000000000000000000000000000000000000000" as const;

test("dev buy cap is 2.5% without supply caps", () => {
  assert.equal(
    masterDevBuyCapPct({ maxTx: false, maxTxBps: 100, maxWallet: false, maxWalletBps: 200 }),
    MAX_DEV_BUY_SUPPLY_PCT,
  );
});

test("dev buy cap follows the tightest active supply cap", () => {
  assert.equal(masterDevBuyCapPct({ maxTx: true, maxTxBps: 100, maxWallet: false, maxWalletBps: 200 }), 1);
  assert.equal(masterDevBuyCapPct({ maxTx: false, maxTxBps: 100, maxWallet: true, maxWalletBps: 200 }), 2);
  assert.equal(masterDevBuyCapPct({ maxTx: true, maxTxBps: 100, maxWallet: true, maxWalletBps: 50 }), 0.5);
});

test("master dev buy wei is clamped to the max-tx cap in both input modes", () => {
  const modules = { ...DEFAULT_LAUNCH_STATE.modules, maxTx: true, maxTxBps: 100, maxWallet: false };
  const bySupply = resolveDevBuyQuoteWei(
    { ...DEFAULT_LAUNCH_STATE, modules, devBuyMode: "supply", devBuySupplyPct: 2.5 },
    { rail: "master", quote: zero },
  );
  const onePct = resolveDevBuyQuoteWei(
    { ...DEFAULT_LAUNCH_STATE, modules, devBuyMode: "supply", devBuySupplyPct: 1 },
    { rail: "master", quote: zero },
  );
  assert.ok(bySupply && onePct);
  assert.equal(bySupply, onePct);

  const byEth = resolveDevBuyQuoteWei(
    { ...DEFAULT_LAUNCH_STATE, modules, devBuyMode: "eth", devBuyEth: "10" },
    { rail: "master", quote: zero },
  );
  assert.equal(byEth, onePct);
});

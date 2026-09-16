import assert from "node:assert/strict";
import test from "node:test";

import { isPrivyWagmiConnector, PRIVY_LOGIN_METHODS, privyConfig } from "./privy";

test("Privy login methods are email/Google/Twitter — wallets stay on RainbowKit", () => {
  assert.deepEqual([...PRIVY_LOGIN_METHODS], ["email", "google", "twitter"]);
  assert.equal((PRIVY_LOGIN_METHODS as readonly string[]).includes("wallet"), false);
  assert.deepEqual(privyConfig.loginMethods, ["email", "google", "twitter"]);
  assert.equal(privyConfig.loginMethods?.includes("wallet"), false);
});

test("wallet picker hides the Privy embedded connector", () => {
  assert.equal(isPrivyWagmiConnector({ id: "privy", name: "Privy" }), true);
  assert.equal(isPrivyWagmiConnector({ id: "io.privy.privy", name: "Embedded Wallet", type: "privy" }), true);
  assert.equal(isPrivyWagmiConnector({ id: "io.metamask", name: "MetaMask" }), false);
  assert.equal(isPrivyWagmiConnector({ id: "injected", name: "Injected" }), false);
  assert.equal(isPrivyWagmiConnector({ id: "walletConnect", name: "WalletConnect" }), false);
});

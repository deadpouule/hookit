import { expect, test } from "@playwright/test";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
} from "viem";

const enabled = process.env.FORK_E2E === "1";
const rpcUrl = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8545";
const indexerUrl = process.env.FORK_INDEXER_URL ?? "http://127.0.0.1:8787";
const account = getAddress(
  process.env.FORK_E2E_ACCOUNT ??
    "0x100000000000000000000000000000000000E2E1",
);
const opsTreasury = getAddress(
  process.env.FORK_OPS_TREASURY ??
    "0x67B436693b7f8ebAD6b1B1Caf88C2E197d961614",
);

const inkFork = {
  id: 57_073,
  name: "Ink fork",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

const client = createPublicClient({
  chain: inkFork,
  transport: http(rpcUrl),
});

const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

test.describe("Hookit Ink fork wallet E2E", () => {
  test.skip(!enabled, "Set FORK_E2E=1 and start the local fork stack.");
  test.describe.configure({ mode: "serial" });

  test("launches, indexes, buys and sells a multi-pair token", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.addInitScript(
      ({ account: injectedAccount, rpc }) => {
        let requestId = 1;
        const listeners = new Map<string, Array<(value: unknown) => void>>();
        const emit = (event: string, value: unknown) => {
          for (const listener of listeners.get(event) ?? []) listener(value);
        };

        const provider = {
          isMetaMask: true,
          chainId: "0xdef1",
          selectedAddress: injectedAccount,
          _metamask: { isUnlocked: async () => true },
          on(event: string, listener: (value: unknown) => void) {
            const current = listeners.get(event) ?? [];
            current.push(listener);
            listeners.set(event, current);
            return provider;
          },
          removeListener(event: string, listener: (value: unknown) => void) {
            listeners.set(
              event,
              (listeners.get(event) ?? []).filter((item) => item !== listener),
            );
            return provider;
          },
          async request({
            method,
            params = [],
          }: {
            method: string;
            params?: readonly unknown[];
          }) {
            if (method === "eth_requestAccounts" || method === "eth_accounts") {
              return [injectedAccount];
            }
            if (method === "eth_chainId") return "0xdef1";
            if (method === "net_version") return "57073";
            if (
              method === "wallet_switchEthereumChain" ||
              method === "wallet_addEthereumChain"
            ) {
              emit("chainChanged", "0xdef1");
              return null;
            }
            const response = await fetch(rpc, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: requestId++,
                method,
                params,
              }),
            });
            const payload = await response.json();
            if (payload.error) {
              const error = new Error(payload.error.message) as Error & {
                code?: number;
                data?: unknown;
              };
              error.code = payload.error.code;
              error.data = payload.error.data;
              throw error;
            }
            return payload.result;
          },
        };

        Object.defineProperty(window, "ethereum", {
          configurable: true,
          value: provider,
        });
        const detail = {
          info: {
            uuid: "350670db-19fa-4704-a166-e52e178b59d2",
            name: "Anvil E2E",
            icon:
              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%239514d1'/><text x='16' y='22' text-anchor='middle' font-size='18' fill='white'>A</text></svg>",
            rdns: "io.hookit.anvil-e2e",
          },
          provider,
        };
        const announce = () =>
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", { detail }),
          );
        window.addEventListener("eip6963:requestProvider", announce);
        queueMicrotask(announce);
      },
      { account: account.toLowerCase(), rpc: rpcUrl },
    );

    const opsBefore = await client.getBalance({ address: opsTreasury });

    await page.goto("/launch/custom");
    const connectedWallet = page
      .getByRole("button", { name: /0x10.*e2e1/i })
      .first();
    await connectedWallet.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    if (!(await connectedWallet.isVisible().catch(() => false))) {
      const connect = page.getByRole("button", { name: /^Connect$/i });
      await expect(connect).toBeEnabled({ timeout: 15_000 });
      await connect.click();
      const injected = page
        .getByRole("button")
        .filter({ hasText: /Anvil E2E|MetaMask|Injected|Browser Wallet/i })
        .first();
      await expect(injected).toBeVisible({ timeout: 15_000 });
      await injected.click();
    }
    await expect(connectedWallet).toBeVisible({ timeout: 20_000 });

    await page.getByRole("textbox", { name: "My Token" }).fill("Fork E2E");
    await page.getByRole("textbox", { name: "TKN" }).fill("FE2E");
    await page.getByRole("tab", { name: /Multi-pair/i }).click();
    await expect(
      page.getByText(/Liquidity split across pools/i),
    ).toBeVisible();

    for (let step = 0; step < 5; step += 1) {
      const launchButton = page.getByRole("button", { name: "Launch token" });
      if (await launchButton.isVisible().catch(() => false)) break;
      await page.getByRole("button", { name: "Continue" }).click();
    }

    const launchButton = page.getByRole("button", { name: "Launch token" });
    await expect(launchButton).toBeEnabled({ timeout: 20_000 });
    await launchButton.click();
    await page.waitForURL(/\/token\/0x[a-fA-F0-9]{40}/, {
      timeout: 90_000,
    });

    const tokenMatch = page.url().match(/\/token\/(0x[a-fA-F0-9]{40})/);
    expect(tokenMatch).toBeTruthy();
    const token = getAddress(tokenMatch![1]!) as Address;

    const opsAfter = await client.getBalance({ address: opsTreasury });
    expect(opsAfter - opsBefore).toBe(500_000_000_000_000n - 1n);

    await expect
      .poll(
        async () => {
          const response = await request.get(
            `${indexerUrl}/v1/tokens/${token}`,
          );
          return response.ok();
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          const launches = await request.get("/api/launches");
          if (!launches.ok()) return null;
          const launchBody = (await launches.json()) as {
            pools: Array<{ contractAddress?: string; marketCount?: number }>;
          };
          return (
            launchBody.pools.find(
              (pool) =>
                pool.contractAddress?.toLowerCase() === token.toLowerCase(),
            )?.marketCount ?? null
          );
        },
        { timeout: 45_000 },
      )
      .toBe(2);

    const tokenBeforeBuy = await client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [account],
    });
    const amountInput = page.getByPlaceholder("0.0").first();
    await amountInput.fill("0.01");
    await expect(
      page.getByRole("button", { name: "Buy FE2E" }),
    ).toBeEnabled({ timeout: 30_000 });
    await page.getByRole("button", { name: "Buy FE2E" }).click();
    await expect(page.getByText("Trade confirmed").first()).toBeVisible({
      timeout: 60_000,
    });

    const tokenAfterBuy = await client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [account],
    });
    expect(tokenAfterBuy).toBeGreaterThan(tokenBeforeBuy);

    await page.getByRole("button", { name: /^Sell$/i }).click();
    const sellAmount = (tokenAfterBuy - tokenBeforeBuy) / 4n;
    await page.getByPlaceholder("0.0").first().fill(formatUnits(sellAmount, 18));
    const ethBeforeSell = await client.getBalance({ address: account });
    await expect(
      page.getByRole("button", { name: "Sell FE2E" }),
    ).toBeEnabled({ timeout: 30_000 });
    await page.getByRole("button", { name: "Sell FE2E" }).click();
    await expect
      .poll(
        () =>
          client.readContract({
            address: token,
            abi: tokenAbi,
            functionName: "balanceOf",
            args: [account],
          }),
        { timeout: 60_000 },
      )
      .toBe(tokenAfterBuy - sellAmount);

    const tokenAfterSell = await client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [account],
    });
    const ethAfterSell = await client.getBalance({ address: account });
    expect(tokenAfterSell).toBe(tokenAfterBuy - sellAmount);
    expect(ethAfterSell).toBeGreaterThan(ethBeforeSell);

    await expect
      .poll(
        async () => {
          const response = await request.get(
            `${indexerUrl}/v1/tokens/${token}/trades?limit=10`,
          );
          if (!response.ok()) return 0;
          const body = (await response.json()) as {
            trades?: Array<{ side: "buy" | "sell" }>;
          };
          const sides = new Set(body.trades?.map((trade) => trade.side) ?? []);
          return sides.has("buy") && sides.has("sell") ? sides.size : 0;
        },
        { timeout: 30_000 },
      )
      .toBe(2);

    await expect(page.getByText("Fork E2E").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("fork-launch-buy-sell.png"),
      fullPage: true,
    });
    expect(runtimeErrors).toEqual([]);
  });
});

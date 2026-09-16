import { expect, test } from "@playwright/test";

import { dismissWelcomeGate, openApp } from "./helpers";

/**
 * UI smoke - no wallet required.
 *   SMOKE_BASE_URL=https://www.hookit.fun npm run smoke:ui
 *
 * For wallet flows: connect manually in headed mode:
 *   npm run smoke:ui:headed
 */
test.describe("Hookit UI smoke", () => {
  test("Welcome gate can be agreed", async ({ page }) => {
    await page.goto("/");
    await dismissWelcomeGate(page);
    await expect(page.locator("#tokens, .token-grid, .mobile-token-row").first()).toBeVisible({
      timeout: 45_000,
    });
  });

  test("Welcome connect offers social login and Rainbow wallets", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop chrome only");
    await openApp(page, "/");
    const connect = page.getByRole("button", { name: /^Connect$/ }).first();
    await expect(connect).toBeEnabled({ timeout: 20_000 });
    await connect.click();
    await expect(page.getByRole("heading", { name: "Welcome to Hookit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Twitter" })).toBeVisible();
    await page.getByRole("button", { name: "Continue with a wallet" }).click();
    await expect(page.getByRole("heading", { name: "Select your wallet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Privy" })).toHaveCount(0);
  });

  test("Explore home loads tokens", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop chrome only");
    await openApp(page, "/");
    await expect(page.getByRole("navigation", { name: "Product" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Docs" }).first()).toBeVisible();
    const tokensSection = page.locator("#tokens, .token-grid, .market-card").first();
    await expect(tokensSection).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Live on Ink/i).first()).toBeHidden();
  });

  test("Launch page renders wizard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop chrome only");
    await openApp(page, "/launch");
    await expect(page.getByText(/Choose a launch model|Classic\.|Master\./i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Token desk opens from explore", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop chrome only");
    await openApp(page, "/");
    const card = page.locator(".market-card").first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await card.click();
    await expect(page).toHaveURL(/\/token\//, { timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Swap|Buy|Sell|Connect|Enter amount/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Mobile chrome matches BaseStonk layout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await openApp(page, "/");
    await expect(page.getByRole("navigation", { name: "Product" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "Tokens" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Launch a token" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Search tokens" })).toBeVisible();
    await expect(page.getByText(/Invite traders, earn creator fees/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tokens" })).toBeVisible();
  });

  test("Mobile explore opens a token", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await openApp(page, "/");
    const row = page.locator(".mobile-token-row").first();
    await expect(row).toBeVisible({ timeout: 45_000 });
    await row.click();
    await expect(page).toHaveURL(/\/token\//, { timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Swap|Buy|Sell|Connect|Enter amount/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Mobile launch page renders wizard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await openApp(page, "/launch");
    await expect(page.getByRole("heading", { name: /Classic\.|Master\./ }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("API launches returns pools", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "once per run");
    const res = await request.get("/api/launches");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.pools)).toBeTruthy();
    expect(body.pools.length).toBeGreaterThan(0);
    const dynamic = body.pools.find(
      (p: { contractAddress?: string; hooks?: { dynamicFees?: boolean }; lpFee?: number }) =>
        p.hooks?.dynamicFees || p.lpFee === 0x800000,
    );
    if (dynamic) {
      expect(dynamic.lpFee === 0x800000 || dynamic.hooks?.dynamicFees).toBeTruthy();
    }
  });

  test("Token desk chart scrubs and creator fees are public", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop chart chrome only");
    await openApp(page, "/");
    const card = page.locator(".market-card").first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await card.click();
    await expect(page).toHaveURL(/\/token\//, { timeout: 20_000 });

    const plot = page.locator(".token-chart-plot").first();
    await expect(plot).toBeVisible({ timeout: 30_000 });
    const box = await plot.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.5);
    await expect(page.getByText(/Market cap/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Price" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mcap" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Candles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Line" })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/Creator fees/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^Claim$/i })).toHaveCount(0);
  });

  test("Privileged API routes stay locked", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "once per run");
    const deploy = await request.post("/api/hooks/deploy", { data: { source: "contract X {}" } });
    expect([401, 503]).toContain(deploy.status());

    const prepare = await request.post("/api/hooks/prepare", { data: { source: "contract X {}" } });
    expect([401, 503]).toContain(prepare.status());

    const sneaky = await request.get("/api/indexer/admin");
    expect(sneaky.status()).toBe(404);
  });

  test("API eth-usd is live-ish", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "once per run");
    const res = await request.get("/api/eth-usd");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ethUsd).toBeGreaterThan(500);
    expect(body.ethUsd).toBeLessThan(20_000);
    expect(body.launchEthUsd).toBeGreaterThan(500);
    expect(body.launchEthUsd).toBeLessThan(20_000);
    expect(Math.abs(body.ethUsd - 4000) > 50 || body.ethUsd !== 4000).toBeTruthy();
  });
});

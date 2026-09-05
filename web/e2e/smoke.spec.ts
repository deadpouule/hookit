import { expect, test } from "@playwright/test";

/**
 * UI smoke — no wallet required.
 *   SMOKE_BASE_URL=https://www.hookit.fun npm run smoke:ui
 *
 * For wallet flows: connect manually in headed mode:
 *   npm run smoke:ui:headed
 */
test.describe("Hookit UI smoke", () => {
  test("Explore home loads tokens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Product" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore" }).first()).toBeVisible();
    // Wait for marketplace / token grid or list
    const tokensSection = page.locator("#tokens, .token-grid, .mobile-token-row, .market-card").first();
    await expect(tokensSection).toBeVisible({ timeout: 45_000 });
    // No Live on Ink ticker
    await expect(page.getByText(/LIVE ON INK/i)).toHaveCount(0);
  });

  test("Launch page renders wizard", async ({ page }) => {
    await page.goto("/launch");
    await expect(page.getByText(/Create a hooked token|Launch|Classic|Master/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("Token desk opens from explore", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("a[href^='/token/'], .market-card, .mobile-token-row").first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await card.click();
    await expect(page).toHaveURL(/\/token\//, { timeout: 20_000 });
    // Swap CTA or connect
    await expect(
      page.getByRole("button", { name: /Swap|Buy|Sell|Connect|Enter amount/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("Mobile top nav present on small viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Product" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "Explore" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Hooks" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Analytics" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
  });

  test("API launches returns pools", async ({ request }) => {
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

  test("API eth-usd is live-ish", async ({ request }) => {
    const res = await request.get("/api/eth-usd");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ethUsd).toBeGreaterThan(500);
    expect(body.ethUsd).toBeLessThan(20_000);
    // Should not be stuck on the $4000 factory seed forever once feed works
    expect(Math.abs(body.ethUsd - 4000) > 50 || body.ethUsd !== 4000).toBeTruthy();
  });
});

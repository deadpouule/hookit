import { expect, type Page } from "@playwright/test";

/** Dismiss the Welcome owl gate by clicking Agree — same path a first-time visitor takes. */
export async function dismissWelcomeGate(page: Page) {
  const gate = page.locator(".legal-gate");
  const cta = page.getByRole("button", { name: /Agree and Continue/i });

  await expect(cta).toBeVisible({ timeout: 10_000 });
  await cta.click();
  await expect(gate).toHaveCount(0);
}

export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await dismissWelcomeGate(page);
}

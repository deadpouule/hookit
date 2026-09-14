import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SMOKE_BASE_URL || "https://www.hookit.fun";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        userAgent: devices["iPhone 13"].userAgent,
        viewport: devices["iPhone 13"].viewport,
        deviceScaleFactor: devices["iPhone 13"].deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
        extraHTTPHeaders: {
          "sec-ch-ua-mobile": "?1",
        },
      },
    },
  ],
});

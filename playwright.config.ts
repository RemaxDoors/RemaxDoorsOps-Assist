import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running instance.
 *
 * BASE_URL points them somewhere else (staging, Azure) without a code change:
 *   BASE_URL=https://ops-staging.azurewebsites.net npx playwright test
 *
 * No webServer block on purpose: these run against whatever is already up, so
 * the same suite covers local, staging and production smoke checks.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});

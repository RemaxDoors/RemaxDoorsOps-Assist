import { test, expect } from "@playwright/test";

/**
 * The gate. These are the tests that matter in Azure, where AUTH_DEV_BYPASS is
 * off: they prove nothing is reachable without a session or an API key.
 *
 * Skipped automatically when the dev bypass is on, since it deliberately opens
 * everything — a pass there would mean nothing.
 */
const bypassOn = process.env.AUTH_DEV_BYPASS === "true";

test.describe("authentication", () => {
  test("landing page offers Microsoft sign-in", async ({ page }) => {
    // With the bypass on there is already a session, so "/" redirects to the
    // dashboard by design. The sign-in page only exists to be seen when off.
    test.skip(bypassOn, "AUTH_DEV_BYPASS=true redirects the landing page");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test.describe(() => {
    test.skip(bypassOn, "AUTH_DEV_BYPASS=true opens the app deliberately");

    test("protected pages redirect to sign-in", async ({ page }) => {
      const response = await page.goto("/dashboard");
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(/\/(\?|$)/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });

    test("API rejects a request with no key", async ({ request }) => {
      const response = await request.get("/api/ncr?limit=1");
      expect(response.status()).toBe(401);
    });

    test("API rejects a wrong key", async ({ request }) => {
      const response = await request.get("/api/ncr?limit=1", {
        headers: { "X-API-Key": "definitely-not-the-key" },
      });
      expect(response.status()).toBe(401);
    });

    test("API accepts the configured key", async ({ request }) => {
      const key = process.env.API_KEY;
      test.skip(!key, "API_KEY not set in this environment");

      const response = await request.get("/api/ncr?limit=1", {
        headers: { "X-API-Key": key! },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toHaveProperty("data");
    });

    test("an API key does not open the UI", async ({ page }) => {
      const key = process.env.API_KEY;
      test.skip(!key, "API_KEY not set in this environment");

      await page.setExtraHTTPHeaders({ "X-API-Key": key! });
      await page.goto("/ncr");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  });
});

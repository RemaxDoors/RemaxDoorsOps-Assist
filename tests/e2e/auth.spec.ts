import { test, expect } from "@playwright/test";

/**
 * The gate. These matter in Azure, where AUTH_DEV_BYPASS is off: they prove
 * nothing is reachable without a Microsoft Entra session.
 *
 * Sign-in belongs to App Service Authentication, so the app never renders a
 * login itself — it redirects to /.auth/login/aad, which only exists when App
 * Service is in front. These assert on that redirect rather than following it,
 * so they pass against a local build as well as against Azure.
 *
 * There is deliberately no API-key test any more: the key was removed, and an
 * assertion that a header we no longer read is rejected would pass for the
 * wrong reason.
 *
 * Skipped when the dev bypass is on, since it opens everything by design and a
 * pass there would mean nothing.
 */
const bypassOn = process.env.AUTH_DEV_BYPASS === "true";

test.describe("authentication", () => {
  test("landing page offers Microsoft sign-in", async ({ page }) => {
    // With the bypass on there is already a session, so "/" redirects to the
    // dashboard by design. The sign-in page only exists to be seen when off.
    test.skip(bypassOn, "AUTH_DEV_BYPASS=true redirects the landing page");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in with microsoft/i }),
    ).toHaveAttribute("href", /^\/\.auth\/login\/aad/);
  });

  test.describe(() => {
    test.skip(bypassOn, "AUTH_DEV_BYPASS=true opens the app deliberately");

    test("protected pages redirect to App Service sign-in", async ({ request }) => {
      // Not followed: /.auth/* is served by App Service, so following it
      // against a local build would 404 for reasons unrelated to the gate.
      const response = await request.get("/dashboard", { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toContain("/.auth/login/aad");
      expect(response.headers().location).toContain(
        `post_login_redirect_uri=${encodeURIComponent("/dashboard")}`,
      );
    });

    test("the requested page is preserved through sign-in", async ({ request }) => {
      const response = await request.get("/ncr/new", { maxRedirects: 0 });
      expect(response.headers().location).toContain(
        `post_login_redirect_uri=${encodeURIComponent("/ncr/new")}`,
      );
    });

    test("API refuses an unauthenticated request in JSON", async ({ request }) => {
      const response = await request.get("/api/ncr?limit=1", { maxRedirects: 0 });

      expect(response.status()).toBe(401);
      // Never a redirect: a browser fetch would follow it cross-origin to a
      // login page and fail opaquely with no status to act on.
      expect(response.headers().location).toBeUndefined();
      expect(response.headers()["content-type"]).toContain("application/json");
      expect(await response.json()).toHaveProperty("error");
    });

    test("an API key is not a way in", async ({ request }) => {
      // The header is no longer read at all; this guards against it quietly
      // coming back.
      const response = await request.get("/api/ncr?limit=1", {
        headers: { "X-API-Key": "anything-at-all" },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(401);
    });

    test("the health probe stays public", async ({ request }) => {
      const response = await request.get("/api/health");
      expect(response.status()).toBe(200);
    });

    /**
     * The Simpro job lookup is deliberately not gated by this app — the
     * platform is its only gate, so the wizard's Fetch Job cannot fail on a
     * session the page itself did not need.
     *
     * Asserted so the exemption is visible and deliberate rather than an
     * accident someone tidies away later.
     */
    test("the Simpro job lookup is not gated by the app", async ({ request }) => {
      const response = await request.get("/api/simpro/job/605787", {
        maxRedirects: 0,
      });
      expect(response.status()).not.toBe(401);
      expect(response.headers().location).toBeUndefined();
    });

    /** And the exemption is that one path, not Simpro generally. */
    test("the rest of the Simpro API is still gated", async ({ request }) => {
      for (const path of ["/api/simpro/staff", "/api/system"]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), `${path} should still refuse`).toBe(401);
      }
    });
  });
});

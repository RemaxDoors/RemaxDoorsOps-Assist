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

    test("the health probe stays public", async ({ request }) => {
      const response = await request.get("/api/health");
      expect(response.status()).toBe(200);
    });

    /**
     * This app no longer gates /api/* at all.
     *
     * Signing in happens once, when a page is opened. Re-checking on every
     * fetch that page then makes refused saves from a form that was open and
     * filled in — the person had no way to satisfy the second gate without
     * reloading and losing their work.
     *
     * App Service is the only gate on these paths now. In Azure it answers
     * them itself, before this app runs, so what these assert is that *this
     * app* adds nothing on top: no 401 of our own, and no redirect a fetch
     * cannot read.
     */
    test("the app adds no gate of its own to /api/*", async ({ request }) => {
      const paths = [
        "/api/ncr?limit=1",
        "/api/ncr/next-id",
        "/api/simpro/job/605787",
        "/api/simpro/staff",
        "/api/m1/jobs?q=1",
      ];

      for (const path of paths) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), `${path} must not be refused by the app`).not.toBe(
          401,
        );
        // A redirect would send a browser fetch cross-origin to a login page,
        // where CORS turns it into an opaque "Failed to fetch" with no status.
        expect(response.headers().location, `${path} must not redirect`).toBeUndefined();
      }
    });

    /**
     * Saving is the case that actually failed in the field, and it is a POST,
     * so it is asserted separately rather than assumed to follow from the GETs.
     * An empty body is rejected by validation (422), never by authentication.
     */
    test("saving an NCR is not refused for want of a sign-in", async ({ request }) => {
      const response = await request.post("/api/ncr", {
        multipart: {},
        maxRedirects: 0,
      });

      expect(response.status()).not.toBe(401);
      expect(response.headers().location).toBeUndefined();
    });

    /** Pages are still gated — that is where signing in belongs. */
    test("pages are still gated when the API is not", async ({ request }) => {
      const response = await request.get("/dashboard", { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toContain("/.auth/login/aad");
    });
  });
});

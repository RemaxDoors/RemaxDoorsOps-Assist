import { test, expect } from "@playwright/test";

/**
 * A lapsed sign-in should be recovered, not reported.
 *
 * App Service sessions expire after roughly 75 minutes. A page navigation then
 * re-authenticates through SSO silently, but a background fetch cannot follow
 * that cross-origin redirect — which is how somebody who signed in ten minutes
 * ago was told "Not signed in" by the NCR wizard.
 *
 * The 401 is forced by intercepting the route rather than by waiting out a real
 * session, so this runs in seconds and with the dev bypass on.
 */
test.describe("session recovery", () => {
  test("a lapsed sign-in on a read sends the browser to sign in again", async ({
    page,
  }) => {
    await page.route("**/api/simpro/job/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not signed in." }),
      }),
    );

    // /.auth/* is served by App Service, so it does not exist against a local
    // build. Catching the navigation here is the assertion.
    let signInUrl: string | null = null;
    await page.route("**/.auth/login/aad**", (route) => {
      signInUrl = route.request().url();
      return route.fulfill({ status: 200, body: "signed in" });
    });

    await page.goto("/ncr/new");
    await page.getByRole("button", { name: /simpro job/i }).first().click();
    await page.getByLabel(/simpro job number/i).fill("605787");
    await page.getByRole("button", { name: /fetch job/i }).click();

    await expect(() => expect(signInUrl).not.toBeNull()).toPass({ timeout: 10_000 });

    // And it must come back to where the person was, not to the dashboard.
    expect(signInUrl!).toContain("/.auth/login/aad");
    expect(signInUrl!).toContain(
      `post_login_redirect_uri=${encodeURIComponent("/ncr/new")}`,
    );
  });

  /*
   * There is deliberately no companion test for the write path. Asserting that
   * no navigation happens is trivially true unless a write is actually
   * triggered, and reaching a real submit needs an NCR with a Simpro job
   * attached — fragile setup for an assertion that would pass either way.
   * The distinction is enforced where it is made, in postJson().
   */
});

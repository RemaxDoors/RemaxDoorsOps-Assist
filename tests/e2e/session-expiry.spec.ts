import { test, expect } from "@playwright/test";

/**
 * A lapsed sign-in must be reported, and must not break the page.
 *
 * The app briefly tried to recover automatically, calling location.assign()
 * on a 401 to send the browser through a silent sign-in. The navigation was
 * slow to complete, and while it was pending every other fetch on the page
 * failed with "Failed to fetch" — including ones that would have worked. A
 * page that looked fine could load nothing, and reloading re-triggered it.
 *
 * The previous test asserted only that the redirect *started*, so it passed
 * while the app was unusable. These assert what actually matters: no
 * navigation, and the page still works afterwards.
 */
test.describe("session expiry", () => {
  test("a 401 is reported without navigating the page away", async ({ page }) => {
    await page.route("**/api/simpro/job/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not signed in." }),
      }),
    );

    let navigatedToSignIn = false;
    await page.route("**/.auth/login/aad**", (route) => {
      navigatedToSignIn = true;
      return route.fulfill({ status: 200, body: "signed in" });
    });

    await page.goto("/ncr/new");
    await page.getByRole("button", { name: /simpro job/i }).first().click();
    await page.getByPlaceholder(/605929/).fill("605787");
    await page.getByRole("button", { name: /fetch job/i }).click();

    // The person is told, in words they can act on.
    await expect(page.getByText(/sign-in has expired|not signed in/i)).toBeVisible({
      timeout: 10_000,
    });

    expect(navigatedToSignIn, "must not redirect away from a filled form").toBe(
      false,
    );
    await expect(page).toHaveURL(/\/ncr\/new$/);
  });

  test("the page still works after a failed call", async ({ page }) => {
    // The regression that mattered: one 401 left every later request broken.
    let failNext = true;
    await page.route("**/api/simpro/job/**", (route) => {
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Not signed in." }),
        });
      }
      return route.continue();
    });

    await page.goto("/ncr/new");
    await page.getByRole("button", { name: /simpro job/i }).first().click();
    const input = page.getByPlaceholder(/605929/);

    await input.fill("605787");
    await page.getByRole("button", { name: /fetch job/i }).click();
    await expect(page.getByText(/sign-in has expired|not signed in/i)).toBeVisible({
      timeout: 10_000,
    });

    // Same page, second attempt, no reload. It must reach the server.
    const reachedServer = page.waitForResponse(
      (r) => r.url().includes("/api/simpro/job/") && r.status() !== 401,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /fetch job/i }).click();
    await reachedServer;
  });
});

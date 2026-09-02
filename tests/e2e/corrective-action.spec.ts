import { test, expect } from "@playwright/test";

/**
 * The planner and production manager path.
 *
 * Read-only on purpose: closing an NCR writes to a live quality system, so the
 * test proves the form is present, populated and guarded rather than
 * exercising the write. The write itself is covered by the API test below,
 * which only checks that an invalid close is refused.
 */
test.describe("corrective action", () => {
  test("form is on the NCR detail page, populated and inert until edited", async ({
    page,
  }) => {
    await page.goto("/ncr");
    await page
      .locator('a[href^="/ncr/"]:not([href="/ncr/new"])')
      .filter({ visible: true }).first().click();

    await expect(page.getByRole("heading", { name: "Corrective action" })).toBeVisible();

    const save = page.getByRole("button", { name: /^Save/ });
    await expect(save).toBeDisabled();

    // Typing makes it saveable — proves the dirty check is wired up.
    await page.locator("textarea").fill("Checked and adjusted during review.");
    await expect(save).toBeEnabled();
  });

  test("closing offers a distinct action once complete is ticked", async ({ page }) => {
    await page.goto("/ncr?status=Open");
    await page
      .locator('a[href^="/ncr/"]:not([href="/ncr/new"])')
      .filter({ visible: true }).first().click();

    await page.locator("textarea").fill("Root cause found and corrected.");
    await page.getByRole("checkbox").check();

    await expect(
      page.getByRole("button", { name: "Save and close NCR" }),
    ).toBeEnabled();
  });
});

test.describe("corrective action API", () => {
  const key = process.env.API_KEY;
  const headers = {
    "Content-Type": "application/json",
    ...(key ? { "X-API-Key": key } : {}),
  };

  test("refuses to close without a corrective action", async ({ request }) => {
    test.skip(!key && process.env.AUTH_DEV_BYPASS !== "true", "no API key");

    const list = await (await request.get("/api/ncr?limit=1", { headers })).json();
    test.skip(!list.data?.length, "no NCRs to test against");

    const response = await request.patch(`/api/ncr/${list.data[0].id}`, {
      headers,
      data: { correctiveAction: "", complete: true },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(JSON.stringify(body.issues)).toContain("before marking it complete");
  });

  test("unknown NCR returns 404, not a silent success", async ({ request }) => {
    test.skip(!key && process.env.AUTH_DEV_BYPASS !== "true", "no API key");

    const response = await request.patch("/api/ncr/99999999", {
      headers,
      data: { correctiveAction: "Nothing to see", complete: false },
    });
    expect(response.status()).toBe(404);
  });
});

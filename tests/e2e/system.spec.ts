import { test, expect } from "@playwright/test";

/**
 * The system check, run against whatever environment BASE_URL points at.
 *
 * These are the tests worth pointing at Azure after a deploy:
 *
 *   BASE_URL=https://<app>.azurewebsites.net npx playwright test system
 *
 * The API half needs only an API key, so it works from a laptop or a pipeline
 * against the deployed instance without an interactive sign-in.
 */
test.describe("system check API", () => {

  test("reports every check, and its status code carries the verdict", async ({
    request,
  }) => {
    const response = await request.get("/api/system", {
    });

    // 200 when nothing failed, 503 when something did — both are valid
    // answers from a working endpoint, so accept either and read the body.
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty("checks");
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks.length).toBeGreaterThan(0);
    expect(body.ok).toBe(response.status() === 200);

    for (const check of body.checks) {
      expect(check).toMatchObject({
        id: expect.any(String),
        group: expect.any(String),
        label: expect.any(String),
        detail: expect.any(String),
      });
      expect(["pass", "warn", "fail"]).toContain(check.status);
    }
  });

  test("nothing required is failing", async ({ request }) => {
    const response = await request.get("/api/system", {
    });
    const body = await response.json();

    // Named, so a failure says which check and why rather than "expected 0".
    const failing = (body.checks as Array<{ label: string; detail: string; status: string }>)
      .filter((c) => c.status === "fail")
      .map((c) => `${c.label}: ${c.detail}`);

    expect(failing, `Failing checks:\n${failing.join("\n")}`).toEqual([]);
  });

  test("no secret is returned, only whether it is set", async ({ request }) => {
    const response = await request.get("/api/system", {
    });
    const text = await response.text();

    for (const name of ["DB_PASSWORD", "SIMPRO_API_TOKEN"] as const) {
      const value = process.env[name];
      if (value) expect(text).not.toContain(value);
    }
  });
});

test.describe("system check page", () => {
  test.skip(
    process.env.AUTH_DEV_BYPASS !== "true",
    "needs a session; the API tests above cover a gated environment",
  );

  test("groups the checks and shows the totals", async ({ page }) => {
    await page.goto("/system");

    await expect(page.getByRole("heading", { name: "System check" })).toBeVisible();
    await expect(page.getByText("Passing", { exact: true })).toBeVisible();
    await expect(page.getByText("Failing", { exact: true })).toBeVisible();

    // The groups that exist in every environment. Exact, because "Database"
    // would otherwise also match "Database tables".
    for (const group of ["Settings", "Platform", "Database"]) {
      await expect(
        page.getByRole("heading", { name: group, exact: true }),
      ).toBeVisible();
    }
  });
});

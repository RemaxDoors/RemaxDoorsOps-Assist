import { test, expect } from "@playwright/test";

/**
 * Smoke checks that need no session — safe to run against staging or
 * production immediately after a deploy.
 */
test.describe("health", () => {
  test("reports M1 and Simpro separately", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("database");
    expect(body).toHaveProperty("simpro");
    expect(body.database.ok, "M1 unreachable").toBe(true);
  });

  test("database probe is open without a key", async ({ request }) => {
    const response = await request.get("/api/health/db");
    expect(response.status()).toBe(200);
  });
});

import { NextResponse } from "next/server";
import { isDatabaseConfigured, missingDbConfig } from "@/lib/db/client";
import { pingDatabase } from "@/lib/db/gateway";
import { isSimproConfigured, pingSimpro } from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

export type ServiceHealth = {
  ok: boolean;
  configured: boolean;
  error: string | null;
};

/**
 * One call the UI can use to decide whether it is safe to let someone start
 * filling in a form. Never throws: a failure is reported, not raised.
 */
export async function GET() {
  const [database, simpro] = await Promise.all([checkDatabase(), checkSimpro()]);

  return NextResponse.json({
    database,
    simpro,
    // Simpro is optional; M1 is not. Without M1 nothing can be saved.
    ok: database.ok,
    checkedAt: new Date().toISOString(),
  });
}

async function checkDatabase(): Promise<ServiceHealth> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      error: `M1 is not configured. Missing in .env.local: ${missingDbConfig().join(", ")}`,
    };
  }
  try {
    const ok = await pingDatabase();
    return {
      ok,
      configured: true,
      error: ok ? null : "M1 responded but did not confirm the connection.",
    };
  } catch (error) {
    return { ok: false, configured: true, error: describe(error) };
  }
}

async function checkSimpro(): Promise<ServiceHealth> {
  if (!isSimproConfigured()) {
    return {
      ok: false,
      configured: false,
      error: "Simpro is not connected. Job lookup and tasks are unavailable.",
    };
  }
  try {
    await pingSimpro();
    return { ok: true, configured: true, error: null };
  } catch (error) {
    return { ok: false, configured: true, error: describe(error) };
  }
}

/** Turns driver and HTTP noise into something a person can act on. */
function describe(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/ELOGIN|Login failed/i.test(raw)) {
    return "M1 rejected the login. Check DB_USER and DB_PASSWORD.";
  }
  if (/ETIMEOUT|ETIMEDOUT|timeout/i.test(raw)) {
    return "M1 did not respond in time. The server may be down or unreachable.";
  }
  if (/ESOCKET|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(raw)) {
    return "Could not reach the server. Check DB_SERVER, the port, and the network.";
  }
  if (/\b401\b|Unauthorized/i.test(raw)) {
    return "Simpro rejected the API token. Check SIMPRO_API_TOKEN.";
  }
  if (/\b403\b|Forbidden/i.test(raw)) {
    return "Simpro refused the request. The token may lack permission.";
  }
  if (/\b5\d\d\b/.test(raw)) {
    return `Simpro returned a server error. ${raw.slice(0, 200)}`;
  }
  return raw.slice(0, 300);
}

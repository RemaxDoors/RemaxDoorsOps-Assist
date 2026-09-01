import { NextResponse } from "next/server";
import { isDatabaseConfigured, missingDbConfig } from "@/lib/db/client";
import { pingDatabase } from "@/lib/db/gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: `Missing env vars: ${missingDbConfig().join(", ")}` },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({
      ok: await pingDatabase(),
      database: process.env.DB_NAME,
      server: process.env.DB_SERVER,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "error" },
      { status: 503 },
    );
  }
}

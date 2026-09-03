import { NextResponse } from "next/server";
import { drainSubmissions, queueStatus } from "@/lib/queue/drain";
import { isDatabaseConfigured } from "@/lib/db/client";
import { pingDatabase } from "@/lib/db/gateway";

export const dynamic = "force-dynamic";

/** What is waiting for M1, and why. */
export async function GET() {
  try {
    return NextResponse.json({ data: await queueStatus() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Queue unreadable" },
      { status: 500 },
    );
  }
}

/**
 * Submits everything queued. Safe to call repeatedly — a scheduled job, or a
 * person clicking after the database comes back.
 */
export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "M1 is not configured; nothing can be drained" },
      { status: 503 },
    );
  }

  try {
    await pingDatabase();
  } catch (error) {
    return NextResponse.json(
      {
        error: `M1 is still unreachable: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({ data: await drainSubmissions() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drain failed" },
      { status: 500 },
    );
  }
}

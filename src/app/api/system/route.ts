import { NextResponse } from "next/server";
import { runDiagnostics } from "@/lib/diagnostics/checks";

export const dynamic = "force-dynamic";

/**
 * Every self-check, as JSON.
 *
 * Reachable with an API key as well as a session, so it can be curled from a
 * laptop or a pipeline against the deployed instance — which is the only place
 * several of the answers exist. The status code carries the verdict so a
 * monitor can act on it without parsing the body: 200 when nothing failed,
 * 503 when something did.
 */
export async function GET() {
  try {
    const result = await runDiagnostics();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Checks could not run",
      },
      { status: 500 },
    );
  }
}

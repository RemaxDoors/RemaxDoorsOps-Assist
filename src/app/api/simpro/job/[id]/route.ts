import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  describeSimproError,
  fetchSimproJob,
  isSimproConfigured,
} from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/** Prefill source for step 1 of the Add NCR wizard. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isSimproConfigured()) {
    return NextResponse.json(
      {
        error:
          "Simpro is not connected, so job lookup is unavailable. Raise the NCR without a job.",
      },
      { status: 503 },
    );
  }

  /**
   * Proves whether the request reached this handler at all, and whether Simpro
   * was actually contacted — the distinction that separates "our gate refused
   * it" from "Simpro refused it". Booleans only.
   */
  const store = await headers();
  console.log("[simpro] job lookup", {
    route: "/api/simpro/job/[id]",
    jobId: id,
    hasClientPrincipal: Boolean(store.get("x-ms-client-principal")),
    hasPrincipalName: Boolean(store.get("x-ms-client-principal-name")),
    hasApiKey: Boolean(store.get("x-api-key") ?? store.get("authorization")),
    simproRequestAttempted: true,
  });

  try {
    return NextResponse.json({ data: await fetchSimproJob(id) });
  } catch (error) {
    // The raw text is for us; the caller is a person filling in a form.
    console.error("[simpro] job lookup failed:", error);
    return NextResponse.json(
      { error: describeSimproError(error, `Job ${id}`) },
      { status: 502 },
    );
  }
}

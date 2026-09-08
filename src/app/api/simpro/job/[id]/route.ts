import { NextResponse } from "next/server";
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

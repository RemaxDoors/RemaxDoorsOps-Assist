import { NextResponse } from "next/server";
import { fetchSimproJob, isSimproConfigured } from "@/lib/simpro/client";

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
          "Simpro is not connected yet — add SIMPRO_BASE_URL and SIMPRO_API_TOKEN to .env.local",
      },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({ data: await fetchSimproJob(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simpro lookup failed" },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import { isSimproConfigured, listSimproJobParts } from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/** Parts booked to a Simpro job's cost centres, offered as part choices. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isSimproConfigured()) {
    return NextResponse.json(
      { error: "Simpro is not connected — set SIMPRO_BASE_URL and SIMPRO_API_TOKEN" },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({ data: await listSimproJobParts(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parts lookup failed" },
      { status: 502 },
    );
  }
}

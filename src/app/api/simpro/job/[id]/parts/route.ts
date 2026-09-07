import { NextResponse } from "next/server";
import {
  describeSimproError,
  isSimproConfigured,
  listSimproJobParts,
} from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/** Parts booked to a Simpro job's cost centres, offered as part choices. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isSimproConfigured()) {
    return NextResponse.json(
      { error: "Simpro is not connected, so parts cannot be listed. Type the part number instead." },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({ data: await listSimproJobParts(id) });
  } catch (error) {
    console.error("[simpro] parts lookup failed:", error);
    return NextResponse.json(
      { error: describeSimproError(error, "That job") },
      { status: 502 },
    );
  }
}

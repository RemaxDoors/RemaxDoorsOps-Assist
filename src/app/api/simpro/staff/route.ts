import { NextResponse } from "next/server";
import { isSimproConfigured, listSimproStaff } from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/** Staff who can be assigned a Simpro task. */
export async function GET() {
  if (!isSimproConfigured()) {
    return NextResponse.json({ error: "Simpro is not connected" }, { status: 503 });
  }
  try {
    return NextResponse.json({ data: await listSimproStaff() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Staff lookup failed" },
      { status: 502 },
    );
  }
}

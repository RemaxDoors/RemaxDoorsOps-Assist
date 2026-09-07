import { NextResponse } from "next/server";
import {
  describeSimproError,
  isSimproConfigured,
  listSimproStaff,
} from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/** Staff who can be assigned a Simpro task. */
export async function GET() {
  if (!isSimproConfigured()) {
    return NextResponse.json({ error: "Simpro is not connected, so the staff list is unavailable." }, { status: 503 });
  }
  try {
    return NextResponse.json({ data: await listSimproStaff() });
  } catch (error) {
    console.error("[simpro] staff lookup failed:", error);
    return NextResponse.json(
      { error: describeSimproError(error, "The staff list") },
      { status: 502 },
    );
  }
}

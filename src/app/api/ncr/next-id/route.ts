import { NextResponse } from "next/server";
import { peekNextId } from "@/lib/db/gateway";

export const dynamic = "force-dynamic";

/**
 * The NCR number M1 will hand out next. Shown in the wizard before saving —
 * peeked, never consumed, so nothing is reserved until the NCR is created.
 */
export async function GET() {
  try {
    const nextId = await peekNextId("ncr");
    return NextResponse.json({ data: { nextId } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 500 },
    );
  }
}

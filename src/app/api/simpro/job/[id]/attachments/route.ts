import { NextResponse } from "next/server";
import { isSimproConfigured, listSimproNcrAttachments } from "@/lib/simpro/client";

export const dynamic = "force-dynamic";

/**
 * The photos filed against an NCR on a Simpro job.
 *
 * Fetched by the NCR page after it loads rather than while it renders: Simpro
 * is a third party over the internet, and an NCR record should not wait on it
 * — or fail to open because it is down.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSimproConfigured()) {
    return NextResponse.json({ data: [] });
  }

  const { id: jobId } = await params;
  const ncrId = new URL(request.url).searchParams.get("ncr")?.trim();
  if (!ncrId) {
    return NextResponse.json({ error: "An NCR number is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      data: await listSimproNcrAttachments({ jobId, ncrId }),
    });
  } catch (error) {
    console.error("[simpro] attachment list failed:", error);
    return NextResponse.json(
      { error: "Simpro did not return the attachments for this job." },
      { status: 502 },
    );
  }
}

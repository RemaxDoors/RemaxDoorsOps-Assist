import path from "node:path";
import { NextResponse } from "next/server";
import { getSimproAttachmentFile } from "@/lib/simpro/client";
import { getSession, isDevBypass } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
};

/**
 * Streams one Simpro attachment through the app.
 *
 * Proxied rather than linked so the photo opens for anyone who can see the
 * NCR — Simpro logins are not held by everyone who reviews quality records —
 * and so the API token never leaves the server.
 *
 * Signed in only, for the same reason as the M1 attachment route: this returns
 * file bytes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await getSession();
  if (!session && !isDevBypass()) {
    return NextResponse.json(
      { error: "Sign in to open an attachment." },
      { status: 401 },
    );
  }

  const { id: jobId, fileId } = await params;

  let file: Awaited<ReturnType<typeof getSimproAttachmentFile>>;
  try {
    file = await getSimproAttachmentFile({ jobId, fileId });
  } catch (error) {
    console.error("[simpro] attachment fetch failed:", error);
    return NextResponse.json(
      { error: "Simpro did not return that file." },
      { status: 502 },
    );
  }

  if (!file) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Simpro reports MimeType on the file record; the extension map is the
  // fallback for anything it leaves blank.
  const type =
    file.mimeType ??
    CONTENT_TYPES[path.extname(file.filename).toLowerCase()] ??
    "application/octet-stream";

  return new NextResponse(new Uint8Array(file.contents), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${
        type.startsWith("image/") || type === "application/pdf"
          ? "inline"
          : "attachment"
      }; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { findServableAttachment } from "@/lib/repositories/attachment.repo";
import { getSession, isDevBypass } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Serves an NCR attachment to the person looking at the NCR.
 *
 * M1 stores a file path, and since the app moved to App Service that path
 * names a disk nobody can reach — the panel showed text that opened nothing.
 * The app still holds the file, so it can hand it back.
 *
 * A session is required here even though the other API routes do not require
 * one. Those read and write records the signed-in user could see anyway; this
 * returns file bytes, and an unauthenticated file endpoint is the kind of
 * mistake that ends up in someone else's blog post.
 */
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session && !isDevBypass()) {
    return NextResponse.json(
      { error: "Sign in to open an attachment." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const file = await findServableAttachment(id);
  if (!file) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  let contents: Buffer;
  try {
    contents = await readFile(file.path);
  } catch {
    /**
     * The row exists but the file does not. True for anything uploaded before
     * the app moved hosts, and saying so is more use than a blank page.
     */
    return NextResponse.json(
      {
        error:
          "The file is recorded in M1 but is not on this server. It was most likely uploaded from a different machine.",
      },
      { status: 404 },
    );
  }

  const extension = path.extname(file.filename || file.path).toLowerCase();
  const type = CONTENT_TYPES[extension] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(contents), {
    headers: {
      "Content-Type": type,
      // Images and PDFs open in the browser; anything else downloads.
      "Content-Disposition": `${
        type.startsWith("image/") || type === "application/pdf"
          ? "inline"
          : "attachment"
      }; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

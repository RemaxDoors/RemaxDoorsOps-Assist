import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { insertRowWithAllocatedId, readRows } from "@/lib/db/gateway";
import { uploadSimproJobAttachment } from "@/lib/simpro/client";

/**
 * M1 stores attachments as file references, not blobs — of 61k rows in
 * dbo.Attachments not one populates cmaBLOB, they all point at a path on the
 * shared drive. This module follows that convention: the file is written to
 * ATTACHMENT_DIR, then a row is inserted pointing at it.
 */

export type SavedAttachment = {
  id: string;
  filename: string;
  location: string;
  simproLink: string | null;
  /** Non-fatal problem, e.g. the Simpro copy failed but the file is safe. */
  warning: string | null;
};

/** Maps a MIME type onto one of M1's AttachmentTypes rows. */
function attachmentTypeFor(mimeType: string) {
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("text/")) return "TEXT";
  return "";
}

/**
 * Always absolute: M1 stores this path verbatim and users open it from the
 * ERP, so a path relative to the web server's working directory is useless
 * to them.
 */
function attachmentDir() {
  const dir = process.env.ATTACHMENT_DIR;
  if (!dir) {
    throw new Error(
      "ATTACHMENT_DIR is not set — point it at the share M1 reads attachments from",
    );
  }
  return path.resolve(dir);
}

/** Keeps the stored name unique and free of anything path-like. */
function safeName(ncrId: string, originalName: string) {
  const base = path
    .basename(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return `NCR-${ncrId}-${Date.now()}-${base}`;
}

/**
 * Writes an uploaded file to the attachment store and returns its full path.
 *
 * Split out from saveNcrAttachment so a submission queued while M1 is down can
 * still keep its photos — the M1 row is written later, once there is an NCR
 * number to attach it to.
 */
export async function storeAttachmentFile(
  ncrId: string,
  file: File,
): Promise<string> {
  const dir = attachmentDir();
  const filename = safeName(ncrId, file.name || "upload");
  const target = path.join(dir, filename);

  await mkdir(dir, { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return target;
}

export async function saveNcrAttachment({
  ncrId,
  jobId,
  partId,
  file,
  description,
  createdBy,
  simproJobId,
}: {
  ncrId: string;
  jobId?: string | null;
  partId?: string | null;
  file: File;
  description: string;
  createdBy: string;
  /** When set, a copy is filed under "NCR <id>" on the Simpro job. */
  simproJobId?: string | null;
}): Promise<SavedAttachment> {
  if (!ncrId.trim()) {
    throw new Error("An attachment cannot be saved without an NCR number");
  }

  const dir = attachmentDir();
  const filename = safeName(ncrId, file.name || "upload");
  const target = path.join(dir, filename);
  const contents = Buffer.from(await file.arrayBuffer());

  await mkdir(dir, { recursive: true });
  await writeFile(target, contents);

  // The share copy is the one M1 users open, so it is written first and the
  // Simpro copy is best-effort on top of it.
  let simproLink: string | null = null;
  let warning: string | null = null;
  if (simproJobId) {
    try {
      const uploaded = await uploadSimproJobAttachment({
        jobId: simproJobId,
        ncrId,
        filename,
        contents,
      });
      // The link points at the job, not the file: Simpro publishes no URL for
      // an individual attachment, and the NCR folder sits on the job anyway.
      simproLink = uploaded.url;
    } catch (error) {
      warning = `Saved to the share, but the Simpro copy failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
    }
  }

  const now = new Date();
  const id = await insertRowWithAllocatedId("attachment", {
    cmaAttachmentTypeID: attachmentTypeFor(file.type),
    cmaDate: now,
    cmaShortDescription: description.slice(0, 70),
    cmaFileLocation: target,
    cmaFilename: filename,
    cmaNonConformanceID: ncrId,
    cmaJobID: jobId ?? "",
    cmaPartID: partId ?? "",
    cmaUploadedFromWeb: true,
    ucmaSimproLink: (simproLink ?? "").slice(0, 255),
    cmaCreatedBy: createdBy.slice(0, 20),
    cmaCreatedDate: now,
  });

  return { id, filename, location: target, simproLink, warning };
}

export type NcrAttachment = {
  id: string;
  filename: string;
  description: string;
  location: string;
  simproLink: string | null;
  createdAt: string | null;
  createdBy: string | null;
};

export async function listNcrAttachments(ncrId: string): Promise<NcrAttachment[]> {
  const rows = await readRows<Record<string, unknown>>("attachment", {
    columns: [
      "cmaAttachmentID",
      "cmaFilename",
      "cmaShortDescription",
      "cmaFileLocation",
      "ucmaSimproLink",
      "cmaCreatedDate",
      "cmaCreatedBy",
    ],
    where: [{ column: "cmaNonConformanceID", op: "eq", value: ncrId }],
    orderBy: { column: "cmaCreatedDate", direction: "desc" },
  });

  return rows.map((row) => ({
    id: String(row.cmaAttachmentID).trim(),
    filename: String(row.cmaFilename ?? "").trim(),
    description: String(row.cmaShortDescription ?? "").trim(),
    location: String(row.cmaFileLocation ?? "").trim(),
    simproLink: String(row.ucmaSimproLink ?? "").trim() || null,
    createdAt: row.cmaCreatedDate
      ? new Date(row.cmaCreatedDate as string).toISOString()
      : null,
    createdBy: String(row.cmaCreatedBy ?? "").trim() || null,
  }));
}

/**
 * Records an already-stored file against an NCR.
 *
 * Used when draining the queue: the file was written to the attachment store
 * while M1 was down, so only the M1 row and the optional Simpro copy remain.
 */
export async function recordQueuedAttachment({
  ncrId,
  filePath,
  description,
  createdBy,
  jobId,
  partId,
  simproJobId,
}: {
  ncrId: string;
  filePath: string;
  description: string;
  createdBy: string;
  jobId?: string | null;
  partId?: string | null;
  simproJobId?: string | null;
}): Promise<SavedAttachment> {
  const filename = path.basename(filePath);
  const contents = await readFile(filePath);

  let simproLink: string | null = null;
  let warning: string | null = null;
  if (simproJobId) {
    try {
      const uploaded = await uploadSimproJobAttachment({
        jobId: simproJobId,
        ncrId,
        filename,
        contents,
      });
      simproLink = uploaded.url;
    } catch (error) {
      warning = `Stored, but the Simpro copy failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
    }
  }

  const now = new Date();
  const id = await insertRowWithAllocatedId("attachment", {
    cmaAttachmentTypeID: attachmentTypeFor(
      filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/",
    ),
    cmaDate: now,
    cmaShortDescription: description.slice(0, 70),
    cmaFileLocation: filePath,
    cmaFilename: filename,
    cmaNonConformanceID: ncrId,
    cmaJobID: jobId ?? "",
    cmaPartID: partId ?? "",
    cmaUploadedFromWeb: true,
    ucmaSimproLink: (simproLink ?? "").slice(0, 255),
    cmaCreatedBy: createdBy.slice(0, 20),
    cmaCreatedDate: now,
  });

  return { id, filename, location: filePath, simproLink, warning };
}

import { NextResponse } from "next/server";
import { createNcr, listNcrs } from "@/lib/repositories/ncr.repo";
import { saveNcrAttachment, storeAttachmentFile } from "@/lib/repositories/attachment.repo";
import { requireSession } from "@/lib/auth/session";
import { isDatabaseUnreachable } from "@/lib/db/errors";
import { enqueueSubmission } from "@/lib/queue/submissionQueue";
import { ncrCreateSchema, ncrFilterSchema } from "@/types/ncr";

export const dynamic = "force-dynamic";

/** Keeps one oversized upload from stalling the request. */
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = ncrFilterSchema.safeParse(params);
  if (!filter.success) {
    return NextResponse.json(
      { error: "Invalid filter", issues: filter.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: await listNcrs(filter.data) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

/**
 * Creates the NCR in M1, then saves any attachments.
 *
 * If M1 is unreachable the submission is queued rather than refused: the
 * person on the shop floor keeps their words and their photos, and it lands
 * when the database is back. Anything M1 actively rejects is returned as an
 * error, because retrying it would fail the same way and hide the problem.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  const form = await request.formData();

  const payload = ncrCreateSchema.safeParse({
    partId: form.get("partId") ?? undefined,
    partDescription: form.get("partDescription") ?? undefined,
    jobId: form.get("jobId") ?? undefined,
    categoryId: form.get("categoryId") ?? "",
    codeId: form.get("codeId") ?? undefined,
    causeId: form.get("causeId") ?? undefined,
    description: form.get("description") ?? "",
    quantity: form.get("quantity") ?? 0,
    reportedBy: form.get("reportedBy") ?? "",
    assignedTo: form.get("assignedTo") ?? undefined,
    simproJobId: form.get("simproJobId") ?? undefined,
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: "Check the form", issues: payload.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = payload.data;
  const createdBy = session.email || session.name;
  const warnings: string[] = [];

  const files = form
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const accepted: File[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      warnings.push(`${file.name} is larger than 15MB and was not saved`);
    } else {
      accepted.push(file);
    }
  }

  let ncrId: string;
  try {
    ncrId = await createNcr(input, createdBy);
  } catch (error) {
    if (!isDatabaseUnreachable(error)) {
      return NextResponse.json({ error: message(error) }, { status: 500 });
    }

    // M1 is down. Keep the files and the form, and hand back a reference.
    const attachmentPaths: string[] = [];
    for (const file of accepted) {
      try {
        attachmentPaths.push(await storeAttachmentFile("queued", file));
      } catch (fileError) {
        warnings.push(`Could not hold ${file.name}: ${message(fileError)}`);
      }
    }

    const queued = await enqueueSubmission({
      createdBy,
      input,
      attachmentPaths,
    });

    return NextResponse.json(
      {
        data: { queued: true, queueId: queued.id, attachments: attachmentPaths.length },
        warnings: [
          "M1 is not reachable, so this NCR is held and will be submitted automatically when it is back. Its number is assigned then.",
          ...warnings,
        ],
      },
      { status: 202 },
    );
  }

  for (const file of accepted) {
    try {
      await saveNcrAttachment({
        ncrId,
        jobId: input.jobId,
        partId: input.partId,
        file,
        description: `NCR ${ncrId} — ${file.name}`,
        createdBy,
        simproJobId: input.simproJobId,
      });
    } catch (error) {
      warnings.push(`Could not save ${file.name}: ${message(error)}`);
    }
  }

  return NextResponse.json(
    { data: { ncrId, queued: false, attachments: accepted.length }, warnings },
    { status: 201 },
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

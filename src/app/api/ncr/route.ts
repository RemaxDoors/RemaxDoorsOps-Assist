import { NextResponse } from "next/server";
import { createNcr, listNcrs } from "@/lib/repositories/ncr.repo";
import { saveNcrAttachment } from "@/lib/repositories/attachment.repo";
import { requireSession } from "@/lib/auth/session";
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
 * The NCR is the record of truth: if an attachment fails, the NCR still
 * stands and the failure comes back as a warning rather than losing what the
 * user typed. Raising a Simpro task is a separate, deliberate step.
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
  const warnings: string[] = [];
  let ncrId: string;

  try {
    ncrId = await createNcr(input, session.email || session.name);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }

  const files = form
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      warnings.push(`${file.name} is larger than 15MB and was not saved`);
      continue;
    }
    try {
      await saveNcrAttachment({
        ncrId,
        jobId: input.jobId,
        partId: input.partId,
        file,
        description: `NCR ${ncrId} — ${file.name}`,
        createdBy: session.email || session.name,
        simproJobId: input.simproJobId,
      });
    } catch (error) {
      warnings.push(`Could not save ${file.name}: ${message(error)}`);
    }
  }

  return NextResponse.json(
    { data: { ncrId, attachments: files.length }, warnings },
    { status: 201 },
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

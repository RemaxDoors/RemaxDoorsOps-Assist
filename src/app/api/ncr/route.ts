import { NextResponse } from "next/server";
import { createNcr, listNcrs } from "@/lib/repositories/ncr.repo";
import { saveNcrAttachment, storeAttachmentFile } from "@/lib/repositories/attachment.repo";
import { getSession } from "@/lib/auth/session";
import { employeeNameMap, findEmployeeForUser } from "@/lib/repositories/employee.repo";
import { isDatabaseUnreachable } from "@/lib/db/errors";
import { enqueueSubmission } from "@/lib/queue/submissionQueue";
import { ncrCreateSchema, ncrFilterSchema } from "@/types/ncr";
import { buildDescription } from "@/lib/ncr/description";

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
  /**
   * Read, never required. Signing in happens once when the page is opened; a
   * second check here refused saves from a page that was open and filled in,
   * and cost the person their work.
   *
   * When there is a session it is still the better author — it says who was
   * actually at the keyboard rather than who was picked from a dropdown — so
   * it is preferred below wherever it exists.
   */
  const session = await getSession();

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
    severity: form.get("severity") ?? undefined,
    actualHours: form.get("actualHours") ?? 0,
    additionalCost: form.get("additionalCost") ?? 0,
    additionalCostDetail: form.get("additionalCostDetail") ?? undefined,
    jobName: form.get("jobName") ?? undefined,
    customer: form.get("customer") ?? undefined,
    site: form.get("site") ?? undefined,
    projectManager: form.get("projectManager") ?? undefined,
    m1SalesOrderNumber: form.get("m1SalesOrderNumber") ?? undefined,
    m1QuoteNumber: form.get("m1QuoteNumber") ?? undefined,
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: "Check the form", issues: payload.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const input = payload.data;

  /**
   * qarCreatedBy is nvarchar(20) and every one of M1's existing rows holds an
   * employee id — "DC", "DJZ", "RP". An email does not fit and does not match:
   * "g.erel@remaxdoors.com" is 21 characters, so it was being stored silently
   * truncated and in a format nothing else in M1 uses. Prefer the M1 employee
   * id, and fall back to a name only when the signed-in user has no M1 record.
   */
  const me = session
    ? await findEmployeeForUser({
        email: session.email,
        name: session.name,
      }).catch(() => null)
    : null;

  /**
   * Without a session, the "Reported by" chosen in the wizard is the only
   * statement of who raised this. It is an M1 employee id picked from M1's own
   * list, so it fits qarCreatedBy and matches the format every other row uses
   * — but it is chosen in the browser, so the record no longer proves who
   * typed it. That is the trade for not refusing the save.
   */
  const createdBy = me?.id ?? session?.name ?? session?.email ?? input.reportedBy;

  /**
   * The description is assembled here, not in the browser: the timestamp is
   * the one thing a client must not be able to choose.
   *
   * The author no longer has that guarantee. With a session it is still the
   * signed-in person. Without one, the employee id the form sent is resolved
   * to the name M1 holds against it, so the audit line reads "Reported by
   * Damian Court" rather than "DC", falling back to the id itself — something
   * a supervisor can look up — rather than "Unknown user".
   */
  const author =
    session?.name ||
    session?.email ||
    (await employeeNameMap()
      .then((names) => names.get(input.reportedBy))
      .catch(() => null)) ||
    input.reportedBy;

  const description = buildDescription({
    issue: input.description,
    job: {
      name: input.jobName,
      customer: input.customer,
      site: input.site,
      orderNo: input.m1SalesOrderNumber,
      projectManager: input.projectManager,
      m1QuoteNumber: input.m1QuoteNumber,
    },
    author,
  });
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
    ncrId = await createNcr(
      { ...input, description },
      createdBy,
      session?.name || null,
    );
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
      authorName: session?.name || null,
      // The assembled description, not the raw entry: rebuilding it at drain
      // time would stamp the audit line with the hour M1 came back rather
      // than the hour the person actually reported the problem.
      input: { ...input, description },
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

import { NextResponse } from "next/server";
import {
  getNcr,
  planCorrectiveAction,
  updateCorrectiveAction,
} from "@/lib/repositories/ncr.repo";
import { getSession } from "@/lib/auth/session";
import { isDatabaseUnreachable } from "@/lib/db/errors";
import { ncrUpdateSchema } from "@/types/ncr";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;

  try {
    const ncr = await getNcr(id);
    if (!ncr) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: ncr });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

/**
 * Records a corrective action and closes or reopens the NCR.
 *
 * Not queued when M1 is unreachable, unlike creation: an update is against a
 * record someone may be editing elsewhere, so replaying it later could quietly
 * overwrite a newer change. Better to say it did not save.
 */
export async function PATCH(request: Request, { params }: Context) {
  // See the note in /api/ncr: requireSession() would redirect, which a fetch
  // caller cannot read.
  const actor = await getSession();
  if (!actor) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const payload = ncrUpdateSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: "Check the form", issues: payload.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  /**
   * Dry run: ?dryRun=1 reports the row, the fields, and current versus
   * proposed values, and writes nothing. The plan is built by the same
   * function the write uses, so it cannot describe something other than what
   * would happen.
   */
  const dryRun = new URL(request.url).searchParams.get("dryRun");
  if (dryRun === "1" || dryRun === "true") {
    try {
      const plan = await planCorrectiveAction(id, payload.data);
      if (!plan) {
        return NextResponse.json({ error: `NCR ${id} not found` }, { status: 404 });
      }
      return NextResponse.json({ data: { dryRun: true, ...plan } });
    } catch (error) {
      return NextResponse.json({ error: message(error) }, { status: 500 });
    }
  }

  try {
    const result = await updateCorrectiveAction(id, payload.data);
    if (!result) {
      return NextResponse.json({ error: `NCR ${id} not found` }, { status: 404 });
    }

    // A field that did not store what was sent is reported, not ignored:
    // silent truncation on a quality record is exactly what an audit finds.
    const mismatched = result.verification.filter((f) => !f.verified);
    if (mismatched.length > 0) {
      console.error("[m1] write-back mismatch on NCR", id, mismatched);
    }

    return NextResponse.json({
      data: result.ncr,
      verification: result.verification,
      ...(mismatched.length > 0
        ? {
            warnings: mismatched.map(
              (f) =>
                `${f.field} was saved as "${f.stored}" rather than "${f.intended}".`,
            ),
          }
        : {}),
    });
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return NextResponse.json(
        { error: "M1 is not reachable, so this change was not saved. Try again shortly." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

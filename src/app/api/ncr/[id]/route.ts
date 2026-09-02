import { NextResponse } from "next/server";
import { getNcr, updateCorrectiveAction } from "@/lib/repositories/ncr.repo";
import { requireSession } from "@/lib/auth/session";
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
  await requireSession();
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

  try {
    const updated = await updateCorrectiveAction(id, payload.data);
    if (!updated) {
      return NextResponse.json({ error: `NCR ${id} not found` }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
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

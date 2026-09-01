import { NextResponse } from "next/server";
import { searchM1Jobs, type JobType } from "@/lib/repositories/job.repo";

export const dynamic = "force-dynamic";

/** Job search box in step 1 of the Add NCR wizard. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const term = params.get("q") ?? "";
  const rawType = params.get("type");
  const type: JobType | undefined =
    rawType === "service" || rawType === "project" ? rawType : undefined;

  try {
    const jobs = await searchM1Jobs({
      term,
      type,
      includeClosed: params.get("includeClosed") === "true",
    });
    return NextResponse.json({ data: jobs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job search failed" },
      { status: 500 },
    );
  }
}

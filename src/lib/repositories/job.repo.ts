import "server-only";
import { readRows, type Condition } from "@/lib/db/gateway";

/**
 * M1 job lookup for the NCR wizard's job search box.
 *
 * M1 classifies jobs as PRODUCTION or SERVICE. Simpro calls the equivalent
 * "Project" and "Service", so the wizard speaks Simpro's language and this
 * module translates.
 */

export type JobType = "service" | "project";

export type M1Job = {
  jobId: string;
  partId: string | null;
  partDescription: string | null;
  customerId: string | null;
  type: string | null;
  jobDate: string | null;
  closed: boolean;
};

const M1_TYPE: Record<JobType, string> = {
  service: "SERVICE",
  project: "PRODUCTION",
};

export async function searchM1Jobs({
  term,
  type,
  includeClosed = false,
  limit = 25,
}: {
  term: string;
  type?: JobType;
  includeClosed?: boolean;
  limit?: number;
}): Promise<M1Job[]> {
  // Three characters minimum: shorter terms match thousands of the 26k jobs
  // and are never what the user meant.
  const search = term.trim();
  if (search.length < 3) return [];

  const where: Condition[] = [
    // One OR group: job number, part number or part description.
    [
      { column: "jmpJobID", op: "contains", value: search },
      { column: "jmpPartID", op: "contains", value: search },
      { column: "jmpPartShortDescription", op: "contains", value: search },
    ],
  ];
  if (type) where.push({ column: "ujmpJobType", op: "eq", value: M1_TYPE[type] });
  if (!includeClosed) where.push({ column: "jmpClosed", op: "eq", value: false });

  const rows = await readRows<Record<string, unknown>>("job", {
    where,
    orderBy: { column: "jmpJobDate", direction: "desc" },
    limit,
  });

  const clean = (value: unknown) => {
    const s = String(value ?? "").trim();
    return s.length ? s : null;
  };

  return rows.map((row) => ({
    jobId: String(row.jmpJobID).trim(),
    partId: clean(row.jmpPartID),
    partDescription: clean(row.jmpPartShortDescription),
    customerId: clean(row.jmpCustomerOrganizationID),
    type: clean(row.ujmpJobType),
    jobDate: row.jmpJobDate
      ? new Date(row.jmpJobDate as string).toISOString()
      : null,
    closed: Boolean(row.jmpClosed),
  }));
}

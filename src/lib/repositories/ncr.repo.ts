import "server-only";
import {
  columnExists,
  countGrouped,
  countRows,
  insertRowWithAllocatedId,
  readRows,
  updateRow,
  type Condition,
} from "@/lib/db/gateway";
import type {
  Lookup,
  Ncr,
  NcrCreateInput,
  NcrFilter,
  NcrStatus,
} from "@/types/ncr";

/**
 * NCR data access over M1's dbo.NonConformances. Pages and route handlers call
 * only these functions — they never see SQL, the pool, or the table registry.
 *
 * Writes go through insertRowWithAllocatedId, which allocates the next
 * qarNonConformanceID under a table lock — M1 has no IDENTITY on this column.
 */

type Row = Record<string, unknown>;

const text = (value: unknown) => {
  const s = value == null ? "" : String(value).trim();
  return s.length ? s : null;
};

const iso = (value: unknown) =>
  value ? new Date(value as string).toISOString() : null;

async function lookupMap(
  table: "ncrCategory" | "ncrCode" | "ncrCause",
  idColumn: string,
  descriptionColumn: string,
): Promise<Map<string, Lookup>> {
  const rows = await readRows<Row>(table, {
    columns: [idColumn, descriptionColumn],
  });
  return new Map(
    rows.map((row) => {
      const id = String(row[idColumn]).trim();
      return [id, { id, description: String(row[descriptionColumn] ?? "").trim() }];
    }),
  );
}

/**
 * M1 keeps categories, codes and causes in small lookup tables (7-13 rows), so
 * they are fetched whole and joined in memory rather than in SQL — that keeps
 * every query inside the single-table gateway.
 */
async function lookups() {
  const [categories, codes, causes] = await Promise.all([
    lookupMap("ncrCategory", "qagNonConformanceCategoryID", "qagDescription"),
    lookupMap("ncrCode", "qacNonConformanceCodeID", "qacDescription"),
    lookupMap("ncrCause", "qauNonConformanceCauseID", "qauDescription"),
  ]);
  return { categories, codes, causes };
}

const byDescription = (a: Lookup, b: Lookup) =>
  a.description.localeCompare(b.description);

export async function listCategories(): Promise<Lookup[]> {
  const map = await lookupMap(
    "ncrCategory",
    "qagNonConformanceCategoryID",
    "qagDescription",
  );
  return [...map.values()].sort(byDescription);
}

/** Every picklist the Add NCR wizard needs, in one round trip. */
export async function listClassifications(): Promise<{
  categories: Lookup[];
  codes: Lookup[];
  causes: Lookup[];
}> {
  const maps = await lookups();
  return {
    categories: [...maps.categories.values()].sort(byDescription),
    codes: [...maps.codes.values()].sort(byDescription),
    causes: [...maps.causes.values()].sort(byDescription),
  };
}

function toNcr(row: Row, maps: Awaited<ReturnType<typeof lookups>>): Ncr {
  const lookup = (map: Map<string, Lookup>, value: unknown) => {
    const id = text(value);
    return id ? (map.get(id) ?? { id, description: id }) : null;
  };

  return {
    id: String(row.qarNonConformanceID).trim(),
    jobId: text(row.qarJobID),
    partId: text(row.qarPartID),
    partDescription: text(row.qarPartShortDescription),
    category: lookup(maps.categories, row.qarNonConformanceCategoryID),
    code: lookup(maps.codes, row.qarNonConformanceCodeID),
    cause: lookup(maps.causes, row.qarNonConformanceCauseID),
    status: row.qarCorrectiveActionComplete ? "Closed" : "Open",
    description: String(row.qarNonConformanceText ?? "").trim(),
    correctiveAction: text(row.qarCorrectiveActionText),
    correctiveActionDate: iso(row.qarCorrectiveActionDate),
    quantity: Number(row.qarQuantity ?? 0),
    reportedBy: text(row.qarReportedByEmployeeID),
    assignedTo: text(row.uqarAssignedToEmployeeID),
    createdBy: text(row.qarCreatedBy),
    createdAt: iso(row.qarCreatedDate) ?? new Date(0).toISOString(),
  };
}

function conditions(filter: NcrFilter): Condition[] {
  const where: Condition[] = [];

  if (filter.status) {
    where.push({
      column: "qarCorrectiveActionComplete",
      op: "eq",
      value: filter.status === "Closed",
    });
  }
  if (filter.category) {
    where.push({
      column: "qarNonConformanceCategoryID",
      op: "eq",
      value: filter.category,
    });
  }
  if (filter.search) {
    // One OR group: match the term against any identifying field.
    where.push([
      { column: "qarNonConformanceID", op: "contains", value: filter.search },
      { column: "qarJobID", op: "contains", value: filter.search },
      { column: "qarPartID", op: "contains", value: filter.search },
      { column: "qarPartShortDescription", op: "contains", value: filter.search },
    ]);
  }
  return where;
}

export async function listNcrs(filter: NcrFilter): Promise<Ncr[]> {
  const [rows, maps] = await Promise.all([
    readRows<Row>("ncr", {
      where: conditions(filter),
      orderBy: { column: "qarCreatedDate", direction: "desc" },
      limit: filter.limit,
    }),
    lookups(),
  ]);
  return rows.map((row) => toNcr(row, maps));
}

export async function getNcr(id: string): Promise<Ncr | null> {
  const [rows, maps] = await Promise.all([
    readRows<Row>("ncr", {
      where: [{ column: "qarNonConformanceID", op: "eq", value: id }],
      limit: 1,
    }),
    lookups(),
  ]);
  return rows[0] ? toNcr(rows[0], maps) : null;
}

export type NcrCounts = Record<NcrStatus, number> & { total: number };

export async function countByStatus(): Promise<NcrCounts> {
  const [open, closed] = await Promise.all([
    countRows("ncr", [
      { column: "qarCorrectiveActionComplete", op: "eq", value: false },
    ]),
    countRows("ncr", [
      { column: "qarCorrectiveActionComplete", op: "eq", value: true },
    ]),
  ]);
  return { Open: open, Closed: closed, total: open + closed };
}

/** Open NCRs with nobody assigned — the queue that needs a name against it. */
export async function countUnassigned(): Promise<number> {
  return countRows("ncr", [
    { column: "qarCorrectiveActionComplete", op: "eq", value: false },
    { column: "uqarAssignedToEmployeeID", op: "eq", value: "" },
  ]);
}

/**
 * Creates a non-conformance in M1 and returns the allocated NCR number.
 * New records always start open (qarCorrectiveActionComplete = 0).
 */
export async function createNcr(
  input: NcrCreateInput,
  createdBy: string,
): Promise<string> {
  const now = new Date();

  return insertRowWithAllocatedId("ncr", {
    qarJobID: input.jobId ?? "",
    qarPartID: input.partId ?? "",
    qarPartShortDescription: (input.partDescription ?? "").slice(0, 50),
    qarNonConformanceCategoryID: input.categoryId,
    qarNonConformanceCodeID: input.codeId ?? "",
    qarNonConformanceCauseID: input.causeId ?? "",
    qarCorrectiveActionComplete: false,
    qarNonConformanceText: input.description,
    qarQuantity: input.quantity,
    qarReportedByEmployeeID: input.reportedBy,
    uqarAssignedToEmployeeID: input.assignedTo ?? "",
    qarCreatedBy: createdBy.slice(0, 20),
    qarCreatedDate: now,
  });
}

/**
 * Records the Simpro task raised for an NCR, so M1 can point back at it.
 *
 * uqarSimproTaskID is a user-defined column (see m1/M1-Setup.md). If it has
 * not been added yet this returns a message rather than throwing, so raising
 * the task still succeeds.
 */
export async function setNcrSimproReference(
  ncrId: string,
  { taskId, simproJobId }: { taskId: string; simproJobId?: string | null },
): Promise<{ stored: boolean; message: string | null }> {
  const values: Record<string, unknown> = {};

  if (await columnExists("ncr", "uqarSimproTaskID")) {
    values.uqarSimproTaskID = taskId.slice(0, 20);
  }
  if (simproJobId && (await columnExists("ncr", "uqarSimproJobID"))) {
    values.uqarSimproJobID = simproJobId.slice(0, 20);
  }

  if (Object.keys(values).length === 0) {
    return {
      stored: false,
      message:
        "Simpro task not recorded against the NCR: add the uqarSimproTaskID " +
        "column to dbo.NonConformances (see m1/M1-Setup.md).",
    };
  }

  const affected = await updateRow("ncr", ncrId, values);
  return affected > 0
    ? { stored: true, message: null }
    : { stored: false, message: `NCR ${ncrId} was not found when storing the task id.` };
}

/** One slice of the category breakdown. */
export type CategoryCount = { id: string; label: string; count: number };

export async function countByCategory(): Promise<CategoryCount[]> {
  const [grouped, maps] = await Promise.all([
    countGrouped("ncr", "qarNonConformanceCategoryID"),
    lookups(),
  ]);

  return grouped.map((row) => ({
    id: row.value,
    label:
      maps.categories.get(row.value)?.description ||
      (row.value ? row.value : "Uncategorised"),
    count: row.count,
  }));
}

export type ReporterCount = { id: string; count: number };

/** Who raises non-conformances, busiest first. */
export async function countByReporter(): Promise<ReporterCount[]> {
  const grouped = await countGrouped("ncr", "qarReportedByEmployeeID");
  return grouped
    .filter((row) => row.value.length > 0)
    .map((row) => ({ id: row.value, count: row.count }));
}

export type MonthlyActivity = {
  raisedThisMonth: number;
  solvedThisMonth: number;
  raisedLastMonth: number;
  solvedLastMonth: number;
};

/**
 * This month against last, so the headline numbers have something to mean.
 * "Solved" is a corrective action completed within the month, which is not the
 * same as an NCR raised that month.
 */
export async function monthlyActivity(): Promise<MonthlyActivity> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const raisedBetween = (from: Date, to?: Date) =>
    countRows("ncr", [
      { column: "qarCreatedDate", op: "gte", value: from },
      ...(to ? [{ column: "qarCreatedDate", op: "lt" as const, value: to }] : []),
    ]);

  const solvedBetween = (from: Date, to?: Date) =>
    countRows("ncr", [
      { column: "qarCorrectiveActionComplete", op: "eq", value: true },
      { column: "qarCorrectiveActionDate", op: "gte", value: from },
      ...(to
        ? [{ column: "qarCorrectiveActionDate", op: "lt" as const, value: to }]
        : []),
    ]);

  const [raisedThisMonth, solvedThisMonth, raisedLastMonth, solvedLastMonth] =
    await Promise.all([
      raisedBetween(startOfThisMonth),
      solvedBetween(startOfThisMonth),
      raisedBetween(startOfLastMonth, startOfThisMonth),
      solvedBetween(startOfLastMonth, startOfThisMonth),
    ]);

  return { raisedThisMonth, solvedThisMonth, raisedLastMonth, solvedLastMonth };
}

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DbError } from "@/components/ui/DbError";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { NcrFilters } from "@/app/(app)/ncr/NcrFilters";
import { listClassifications, listNcrs } from "@/lib/repositories/ncr.repo";
import { listEmployees, type Employee } from "@/lib/repositories/employee.repo";
import { daysSince, formatDate } from "@/lib/format";
import {
  GROUPINGS,
  GROUPING_LABELS,
  ncrFilterSchema,
  type Grouping,
  type Lookup,
  type Ncr,
} from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "All NCRs" };

/**
 * M1 stores who reported an NCR as an employee id, and those ids are terse
 * ("DW", "GE"). The id is the record; the name is what a person recognises,
 * so it is resolved from dbo.Employees for display rather than duplicated
 * into the NCR row.
 */
type NameOf = (employeeId: string | null) => string;

function buildColumns(nameOf: NameOf): Column<Ncr>[] {
  return [
  {
    key: "id",
    header: "NCR",
    className: "w-[120px]",
    render: (row) => (
      <div>
        <Link
          href={`/ncr/${row.id}`}
          className="font-semibold text-ink hover:text-brand-red"
        >
          {row.id}
        </Link>
        <div className="text-[12px] text-ink-muted">{formatDate(row.createdAt)}</div>
      </div>
    ),
  },
  {
    key: "part",
    header: "Part / Job",
    render: (row) => (
      <div className="min-w-[150px]">
        <div className="text-ink">{row.partId ?? "-"}</div>
        <div className="text-[12px] text-ink-muted">
          {row.partDescription ?? (row.jobId ? `Job ${row.jobId}` : "-")}
        </div>
      </div>
    ),
  },
  {
    key: "issue",
    header: "Issue",
    className: "max-w-[340px] min-w-[220px]",
    render: (row) => (
      <p className="line-clamp-2 text-ink-muted">
        {row.description || "No description recorded."}
      </p>
    ),
  },
  {
    key: "classification",
    header: "Category / Cause",
    className: "w-[190px]",
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        {row.category ? (
          <Badge tone="graphite">{row.category.description}</Badge>
        ) : (
          <span className="text-ink-muted">-</span>
        )}
        <span className="text-[12px] text-ink-muted">
          {row.cause?.description ?? "No cause recorded"}
        </span>
      </div>
    ),
  },
  {
    key: "people",
    header: "Reported / Assigned",
    className: "w-[140px]",
    render: (row) => (
      <div className="text-[13px]">
        <div className="text-ink">{nameOf(row.reportedBy)}</div>
        <div className="text-[12px] text-ink-muted">
          {row.assignedTo ? `→ ${nameOf(row.assignedTo)}` : "Unassigned"}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    className: "w-[130px]",
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={row.status === "Open" ? "brand" : "ok"}>{row.status}</Badge>
        <span className="text-[12px] text-ink-muted tabular-nums">
          {row.status === "Open"
            ? `${daysSince(row.createdAt)}d open`
            : formatDate(row.correctiveActionDate)}
        </span>
      </div>
    ),
  },
  ];
}

/**
 * One NCR as a tappable card. Ordered by what matters on site: which NCR and
 * whether it is still open, then the part, then the problem.
 */
function buildNcrCard(nameOf: NameOf) {
  return function ncrCard(row: Ncr) {
  return (
    <Link
      href={`/ncr/${row.id}`}
      className="block px-4 py-3.5 active:bg-canvas"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold text-ink">{row.id}</span>
        <Badge tone={row.status === "Open" ? "brand" : "ok"}>{row.status}</Badge>
      </div>

      <p className="mt-1 text-[13px] font-semibold text-ink">
        {row.partId ?? (row.jobId ? `Job ${row.jobId}` : "No part")}
      </p>
      {row.partDescription ? (
        <p className="text-[12px] text-ink-muted">{row.partDescription}</p>
      ) : null}

      <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-body">
        {row.description || "No description recorded."}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
        {row.category ? <Badge tone="graphite">{row.category.description}</Badge> : null}
        <span>{formatDate(row.createdAt)}</span>
        <span aria-hidden>·</span>
        <span>
          {row.status === "Open"
            ? `${daysSince(row.createdAt)}d open`
            : `closed ${formatDate(row.correctiveActionDate)}`}
        </span>
        <span aria-hidden>·</span>
        <span>{nameOf(row.reportedBy)}</span>
      </div>
    </Link>
    );
  };
}


type Group = { key: string; label: string; rows: Ncr[] };

/**
 * Groups the rows already fetched, rather than querying per group.
 *
 * The list is capped at `limit` rows, so grouping here keeps the counts
 * honest: every group adds up to what is on screen, and no group can claim
 * rows the filter excluded. Groups are ordered biggest first, with the
 * unrecorded bucket last wherever it lands.
 */
function groupRows(rows: Ncr[], groupBy: Grouping, nameOf: NameOf): Group[] {
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const [key, label] =
      groupBy === "category"
        ? [row.category?.id ?? "", row.category?.description ?? "No category"]
        : groupBy === "code"
          ? [row.code?.id ?? "", row.code?.description ?? "No code"]
          : groupBy === "cause"
            ? [row.cause?.id ?? "", row.cause?.description ?? "No cause"]
            : groupBy === "reporter"
              ? [row.reportedBy ?? "", row.reportedBy ? nameOf(row.reportedBy) : "Nobody recorded"]
              : [row.assignedTo ?? "", row.assignedTo ? nameOf(row.assignedTo) : "Nobody assigned"];

    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { key: key || "(none)", label, rows: [row] });
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === "(none)") return 1;
    if (b.key === "(none)") return -1;
    return b.rows.length - a.rows.length;
  });
}

export default async function NcrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = ncrFilterSchema.safeParse({
    status: raw.status,
    category: raw.category,
    code: raw.code,
    cause: raw.cause,
    reporter: raw.reporter,
    assignee: raw.assignee,
    from: raw.from,
    to: raw.to,
    search: raw.search,
    limit: raw.limit,
  });
  // An unparseable filter falls back to no filter rather than an error page:
  // the usual cause is a hand-edited URL, and an empty list would look like
  // "no NCRs" instead of "that link is wrong".
  const filter = parsed.success ? parsed.data : { limit: 50 };
  const groupBy: Grouping = GROUPINGS.includes(raw.groupBy as Grouping)
    ? (raw.groupBy as Grouping)
    : "none";

  let rows: Ncr[] = [];
  let categories: Lookup[] = [];
  let codes: Lookup[] = [];
  let causes: Lookup[] = [];
  let employees: Employee[] = [];
  let staff = new Map<string, string>();
  try {
    const [ncrs, classifications, people] = await Promise.all([
      listNcrs(filter),
      listClassifications(),
      listEmployees(),
    ]);
    rows = ncrs;
    categories = classifications.categories;
    codes = classifications.codes;
    causes = classifications.causes;
    employees = people;
    staff = new Map(people.map((e) => [e.id, e.name]));
  } catch (error) {
    return <DbError error={error} />;
  }

  // Falls back to the raw id for anyone no longer in dbo.Employees, so a
  // leaver's NCRs still say who raised them.
  const nameOf: NameOf = (employeeId) =>
    employeeId ? (staff.get(employeeId) ?? employeeId) : "-";

  return (
    <>
      <PageHeader
        title="Non-conformance reports"
        actions={
          <>
            <RefreshButton />
            <Link href="/ncr/new">
              <Button>Add NCR</Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader
          title={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
          subtitle={
            rows.length >= filter.limit
              ? `Showing the newest ${filter.limit} — narrow the filters to see more`
              : "Filter by status, category or keyword"
          }
        />
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <NcrFilters
            categories={categories}
            codes={codes}
            causes={causes}
            employees={employees}
          />
        </div>
        {groupBy === "none" ? (
          <DataTable
            columns={buildColumns(nameOf)}
            rows={rows}
            rowKey={(row) => row.id}
            card={buildNcrCard(nameOf)}
            empty="No NCRs match these filters."
          />
        ) : (
          groupRows(rows, groupBy, nameOf).map((group) => (
            <section key={group.key}>
              <h2 className="flex items-baseline justify-between gap-3 border-b border-line bg-canvas px-4 py-2 text-[13px] font-bold text-ink sm:px-5">
                <span>{group.label}</span>
                <span className="text-[12px] font-semibold text-ink-muted tabular-nums">
                  {group.rows.length}
                </span>
              </h2>
              <DataTable
                columns={buildColumns(nameOf)}
                rows={group.rows}
                rowKey={(row) => row.id}
                card={buildNcrCard(nameOf)}
                empty="No NCRs match these filters."
              />
            </section>
          ))
        )}
      </Card>
    </>
  );
}

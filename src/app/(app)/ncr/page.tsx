import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DbError } from "@/components/ui/DbError";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { NcrFilters } from "@/app/(app)/ncr/NcrFilters";
import { listCategories, listNcrs } from "@/lib/repositories/ncr.repo";
import { daysSince, formatDate } from "@/lib/format";
import { ncrFilterSchema, type Lookup, type Ncr } from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "NCR — Operation Help" };

const columns: Column<Ncr>[] = [
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
        <div className="text-ink">{row.reportedBy ?? "-"}</div>
        <div className="text-[12px] text-ink-muted">
          {row.assignedTo ? `→ ${row.assignedTo}` : "Unassigned"}
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

export default async function NcrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = ncrFilterSchema.safeParse({
    status: raw.status,
    category: raw.category,
    search: raw.search,
    limit: raw.limit,
  });
  const filter = parsed.success ? parsed.data : { limit: 50 };

  let rows: Ncr[] = [];
  let categories: Lookup[] = [];
  try {
    [rows, categories] = await Promise.all([listNcrs(filter), listCategories()]);
  } catch (error) {
    return <DbError error={error} />;
  }

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
          <NcrFilters categories={categories} />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty="No NCRs match these filters."
        />
      </Card>
    </>
  );
}

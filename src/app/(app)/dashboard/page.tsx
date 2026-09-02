import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { DbError } from "@/components/ui/DbError";
import { DonutChart } from "@/components/charts/DonutChart";
import { BarChart } from "@/components/charts/BarChart";
import { DashboardFilters } from "@/app/(app)/dashboard/DashboardFilters";
import {
  breakdown,
  countByReporter,
  countByStatus,
  countUnassigned,
  listNcrs,
  periodActivity,
  periodRange,
  type NcrCounts,
  type PeriodActivity,
  type ReporterCount,
  type Slice,
} from "@/lib/repositories/ncr.repo";
import {
  DIMENSIONS,
  DIMENSION_LABELS,
  PERIOD_LABELS,
  type Dimension,
  type Period,
} from "@/types/ncr";
import { employeeNameMap } from "@/lib/repositories/employee.repo";
import { formatDate, daysSince } from "@/lib/format";
import type { Ncr } from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard — Operation Help" };

function parsePeriod(value: unknown): Period {
  return value === "day" || value === "month" || value === "year" || value === "all"
    ? value
    : "year";
}

function parseDimension(value: unknown): Dimension {
  return DIMENSIONS.includes(value as Dimension) ? (value as Dimension) : "category";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const dimension = parseDimension(params.dimension);
  const range = periodRange(period);

  let counts: NcrCounts;
  let unassigned = 0;
  let recent: Ncr[] = [];
  let slices: Slice[] = [];
  let reporters: ReporterCount[] = [];
  let activity: PeriodActivity;
  let staff: Map<string, string>;

  try {
    [counts, unassigned, recent, slices, reporters, activity, staff] =
      await Promise.all([
        countByStatus(),
        countUnassigned(),
        listNcrs({ limit: 6 }),
        breakdown(dimension, range),
        countByReporter(range),
        periodActivity(range),
        employeeNameMap(),
      ]);
  } catch (error) {
    return <DbError error={error} />;
  }

  const inPeriod = slices.reduce((sum, slice) => sum + slice.count, 0);

  // Top raisers only: the tail is a long list of people with one or two each.
  const topReporters = reporters.slice(0, 8).map((row) => ({
    id: row.id,
    label: staff.get(row.id) ?? row.id,
    count: row.count,
  }));

  /**
   * Year-on-year against the same slice of last year, stated plainly. The
   * window is truncated to today's date, so "this year" compares like for like.
   */
  const versusLastYear = (current: number, before: number) => {
    if (!activity.comparable) return "No prior window to compare";
    const sameTime = period === "year" ? " to this date" : "";
    if (before === 0) {
      return current === 0
        ? `None a year ago${sameTime} either`
        : `None a year ago${sameTime}`;
    }
    const change = Math.round(((current - before) / before) * 100);
    if (change === 0) return `Level with last year${sameTime} (${before})`;
    return `${change > 0 ? "+" : ""}${change}% vs last year${sameTime} (${before})`;
  };

  const periodLabel = PERIOD_LABELS[period];

  return (
    <>
      <PageHeader
        title="Operations overview"
        description="Non-conformances across production, install and supply."
        actions={
          <>
            <RefreshButton />
            <Link href="/ncr">
              <Button variant="secondary">View NCRs</Button>
            </Link>
            <Link href="/ncr/new">
              <Button>Add NCR</Button>
            </Link>
          </>
        }
      />

      <DashboardFilters period={period} dimension={dimension} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Raised ${periodLabel}`}
          value={activity.raised}
          hint={versusLastYear(activity.raised, activity.raisedYearAgo)}
          href="/ncr"
          accent="red"
        />
        <StatCard
          label={`Solved ${periodLabel}`}
          value={activity.solved}
          hint={versusLastYear(activity.solved, activity.solvedYearAgo)}
          href="/ncr?status=Closed"
        />
        <StatCard
          label="Open now"
          value={counts.Open}
          hint="Corrective action outstanding, all time"
          href="/ncr?status=Open"
          accent="red"
        />
        <StatCard
          label="Unassigned"
          value={unassigned}
          hint="Open with nobody named"
          href="/ncr?status=Open"
          accent="light"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`By ${DIMENSION_LABELS[dimension].toLowerCase()}`}
            subtitle={`${inPeriod} raised ${periodLabel}`}
          />
          <CardBody>
            <DonutChart slices={slices} total={inPeriod} centreLabel="raised" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Who raises them"
            subtitle={`Busiest eight, ${periodLabel}`}
          />
          <CardBody>
            <BarChart bars={topReporters} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Latest non-conformances"
          subtitle="Most recently created in M1"
          action={
            <Link href="/ncr">
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState message="No non-conformance records found." />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((ncr) => (
              <li key={ncr.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/ncr/${ncr.id}`}
                    className="font-semibold text-ink hover:text-brand-red"
                  >
                    NCR {ncr.id}
                  </Link>
                  <Badge tone={ncr.status === "Open" ? "brand" : "ok"}>
                    {ncr.status}
                  </Badge>
                  {ncr.category ? (
                    <Badge tone="graphite">{ncr.category.description}</Badge>
                  ) : null}
                  <span className="text-[13px] text-ink-muted">
                    {ncr.partId ?? "No part"} · {formatDate(ncr.createdAt)} ·{" "}
                    {daysSince(ncr.createdAt)}d old
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">
                  {ncr.description || "No description recorded."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

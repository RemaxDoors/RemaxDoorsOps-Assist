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
  adoption,
  breakdown,
  countByCloser,
  countByReporter,
  countByStatus,
  countUnassigned,
  listLatestNcrs,
  periodActivity,
  periodRange,
  type Adoption,
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

export const metadata = { title: "Dashboard" };

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
  let closers: ReporterCount[] = [];
  let usage: Adoption;
  let activity: PeriodActivity;
  let staff: Map<string, string>;

  try {
    [counts, unassigned, recent, slices, reporters, closers, usage, activity, staff] =
      await Promise.all([
        countByStatus(),
        countUnassigned(),
        listLatestNcrs(6),
        breakdown(dimension, range),
        countByReporter(range),
        countByCloser(range),
        adoption(range),
        periodActivity(range),
        employeeNameMap(),
      ]);
  } catch (error) {
    return <DbError error={error} />;
  }

  const inPeriod = slices.reduce((sum, slice) => sum + slice.count, 0);

  // Top eight only: the tail is a long list of people with one or two each.
  const named = (rows: ReporterCount[]) =>
    rows.slice(0, 8).map((row) => ({
      id: row.id,
      label: staff.get(row.id) ?? row.id,
      count: row.count,
    }));

  const topReporters = named(reporters);
  const topClosers = named(closers);

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
            subtitle={`Reported by, busiest eight, ${periodLabel}`}
          />
          <CardBody>
            <BarChart bars={topReporters} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Who closes them"
            /*
             * "Closes", not "solves": M1 records no one against the corrective
             * action itself, so this is who the NCR was assigned to when it was
             * completed. uqarSignedOffBy would be the true answer.
             */
            subtitle={`Assigned to, on NCRs completed ${periodLabel}`}
          />
          <CardBody>
            <BarChart bars={topClosers} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Is it being used"
            subtitle={`Raised through this app, ${periodLabel}`}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-extrabold text-ink tabular-nums">
                  {usage.viaApp}
                </p>
                <p className="text-[12px] text-ink-muted">
                  through the app, of {usage.total} raised
                </p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-ink tabular-nums">
                  {usage.people}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {usage.people === 1 ? "person raising them" : "people raising them"}
                </p>
              </div>
            </div>

            {/*
              A fortnight of days, so "quiet since Tuesday" is visible without
              reading numbers. Bars are relative to the busiest day, and a day
              with none still gets a slot rather than being skipped.
            */}
            <div>
              <p className="mb-1.5 text-[12px] text-ink-muted">Last 14 days</p>
              <div className="flex h-16 items-end gap-1">
                {usage.byDay.map((entry) => {
                  const peak = Math.max(...usage.byDay.map((d) => d.count), 1);
                  const height = entry.count === 0 ? 2 : (entry.count / peak) * 100;
                  return (
                    <div
                      key={entry.day}
                      title={`${entry.day}: ${entry.count}`}
                      className="flex-1 rounded-sm bg-brand-red/80"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                {usage.byDay.at(-1)?.count ?? 0} today
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Latest non-conformances"
          subtitle="Highest NCR numbers in M1"
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

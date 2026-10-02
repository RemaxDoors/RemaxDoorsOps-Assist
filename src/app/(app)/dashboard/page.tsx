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
import { TrendChart } from "@/components/charts/TrendChart";
import { TrendFilters } from "@/app/(app)/dashboard/TrendFilters";
import {
  adoption,
  countByCloser,
  countByReporter,
  countByStatus,
  countUnassigned,
  listLatestNcrs,
  periodActivity,
  trend,
  type Adoption,
  type NcrCounts,
  type PeriodActivity,
  type ReporterCount,
} from "@/lib/repositories/ncr.repo";
import { trendWindow } from "@/lib/ncr/trend";
import {
  TREND_DIMENSIONS,
  TREND_DIMENSION_LABELS,
  TREND_RANGES,
  type Trend,
  type TrendDimension,
  type TrendRange,
} from "@/types/ncr";
import { employeeNameMap } from "@/lib/repositories/employee.repo";
import { formatDate, daysSince, formatMoney } from "@/lib/format";
import type { Ncr } from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "NCR Trend" };

function parseRange(value: unknown): TrendRange {
  return TREND_RANGES.includes(value as TrendRange) ? (value as TrendRange) : "month";
}

function parseDimension(value: unknown): TrendDimension {
  return TREND_DIMENSIONS.includes(value as TrendDimension)
    ? (value as TrendDimension)
    : "category";
}

const date = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

/** How the window reads in a sentence, so every hint says what it counted. */
const WINDOW_LABEL: Record<TrendRange, string> = {
  week: "in the last 7 days",
  month: "in the last 30 days",
  "6months": "in the last 6 months",
  year: "in the last 12 months",
  custom: "in this window",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selected = parseRange(params.range);
  const dimension = parseDimension(params.dimension);
  const from = date(params.from);
  const to = date(params.to);
  const { range, bucket } = trendWindow(selected, from || null, to || null);

  let counts: NcrCounts;
  let unassigned = 0;
  let recent: Ncr[] = [];
  let shape: Trend;
  let reporters: ReporterCount[] = [];
  let closers: ReporterCount[] = [];
  let usage: Adoption;
  let activity: PeriodActivity;
  let staff: Map<string, string>;

  try {
    [counts, unassigned, recent, shape, reporters, closers, usage, activity, staff] =
      await Promise.all([
        countByStatus(),
        countUnassigned(),
        listLatestNcrs(6),
        trend(dimension, range, bucket),
        countByReporter(range),
        countByCloser(range),
        adoption(range),
        periodActivity(range),
        employeeNameMap(),
      ]);
  } catch (error) {
    return <DbError error={error} />;
  }

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
   * The same split as the bars, as a share of the window. The numbers come from
   * the trend that is already loaded rather than a second query, so the donut
   * and the columns can never disagree.
   */
  const slices = shape.series.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: entry.total,
  }));

  /** Cost is a second measure, so it gets its own scale and its own chart. */
  const costBuckets = shape.buckets.map((entry) => ({
    ...entry,
    counts: { cost: entry.cost },
  }));
  const costSeries = [
    { id: "cost", label: "Extra cost", total: Math.round(shape.totalCost) },
  ];

  /**
   * Year-on-year against the same window a year earlier, stated plainly. The
   * comparison window stops at the same point, so a part-finished period is not
   * measured against a whole one.
   */
  const versusLastYear = (current: number, before: number) => {
    if (!activity.comparable) return "No prior window to compare";
    if (before === 0) {
      return current === 0 ? "None a year ago either" : "None a year ago";
    }
    const change = Math.round(((current - before) / before) * 100);
    if (change === 0) return `Level with last year (${before})`;
    return `${change > 0 ? "+" : ""}${change}% vs last year (${before})`;
  };

  const covers = WINDOW_LABEL[selected];
  const breakdown = TREND_DIMENSION_LABELS[dimension].toLowerCase();

  return (
    <>
      <PageHeader
        title="NCR Trend"
        description="Non-conformances over time, by category, reason code, cause, severity and cost."
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

      <TrendFilters range={selected} dimension={dimension} from={from} to={to} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Raised"
          value={activity.raised}
          hint={versusLastYear(activity.raised, activity.raisedYearAgo)}
          href="/ncr"
          accent="red"
        />
        <StatCard
          label="Solved"
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
          label="Extra cost"
          value={formatMoney(shape.totalCost)}
          hint={`Recorded against NCRs raised ${covers}`}
          href="/ncr"
          accent="light"
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title={`NCRs raised by ${breakdown}`}
          subtitle={`${shape.total} raised ${covers}, by ${bucket}`}
        />
        <CardBody>
          <TrendChart buckets={shape.buckets} series={shape.series} />
          {shape.note ? (
            <p className="mt-3 text-[12px] text-ink-muted">{shape.note}</p>
          ) : null}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Extra cost over time"
            subtitle={`${formatMoney(shape.totalCost)} recorded ${covers}`}
          />
          <CardBody>
            <TrendChart
              buckets={costBuckets}
              series={costSeries}
              valueLabel="in extra cost"
              measure="money"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`Share by ${breakdown}`}
            subtitle={`${shape.total} raised ${covers}`}
          />
          <CardBody>
            <DonutChart slices={slices} total={shape.total} centreLabel="raised" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Who raises them"
            subtitle={`Reported by, busiest eight, ${covers}`}
          />
          <CardBody>
            <BarChart bars={topReporters} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Who closes them"
            /*
             * "Closes", not "solves": M1 records no one against the corrective
             * action itself, so this is who the NCR was assigned to when it was
             * completed. uqarSignedOffBy would be the true answer.
             */
            subtitle={`Assigned to, on NCRs completed ${covers}`}
          />
          <CardBody>
            <BarChart bars={topClosers} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
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

        <div className="space-y-4">
          <StatCard
            label="Unassigned"
            value={unassigned}
            hint="Open with nobody named"
            href="/ncr?status=Open"
            accent="light"
          />

          <Card>
            <CardHeader title="Is it being used" subtitle={`Raised through this app, ${covers}`} />
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
      </div>
    </>
  );
}

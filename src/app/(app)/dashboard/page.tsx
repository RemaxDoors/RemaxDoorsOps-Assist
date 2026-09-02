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
import {
  countByCategory,
  countByReporter,
  countByStatus,
  countUnassigned,
  listNcrs,
  monthlyActivity,
  type CategoryCount,
  type MonthlyActivity,
  type NcrCounts,
  type ReporterCount,
} from "@/lib/repositories/ncr.repo";
import { employeeNameMap } from "@/lib/repositories/employee.repo";
import { formatDate, daysSince } from "@/lib/format";
import type { Ncr } from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard — Operation Help" };

export default async function DashboardPage() {
  let counts: NcrCounts;
  let unassigned = 0;
  let recent: Ncr[] = [];
  let categories: CategoryCount[] = [];
  let reporters: ReporterCount[] = [];
  let month: MonthlyActivity;
  let staff: Map<string, string>;

  try {
    [counts, unassigned, recent, categories, reporters, month, staff] =
      await Promise.all([
        countByStatus(),
        countUnassigned(),
        listNcrs({ limit: 6 }),
        countByCategory(),
        countByReporter(),
        monthlyActivity(),
        employeeNameMap(),
      ]);
  } catch (error) {
    return <DbError error={error} />;
  }

  // Top raisers only: the tail is a long list of people with one or two each.
  const topReporters = reporters.slice(0, 8).map((row) => ({
    id: row.id,
    label: staff.get(row.id) ?? row.id,
    count: row.count,
  }));

  const delta = (now: number, before: number) => {
    if (before === 0) return now === 0 ? "Same as last month" : "None last month";
    const change = Math.round(((now - before) / before) * 100);
    if (change === 0) return "Level with last month";
    return `${change > 0 ? "+" : ""}${change}% on last month (${before})`;
  };

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open NCRs"
          value={counts.Open}
          hint="Corrective action outstanding"
          href="/ncr?status=Open"
          accent="red"
        />
        <StatCard
          label="Unassigned"
          value={unassigned}
          hint="Open with nobody named"
          href="/ncr?status=Open"
          accent="red"
        />
        <StatCard
          label="Raised this month"
          value={month.raisedThisMonth}
          hint={delta(month.raisedThisMonth, month.raisedLastMonth)}
          href="/ncr"
        />
        <StatCard
          label="Solved this month"
          value={month.solvedThisMonth}
          hint={delta(month.solvedThisMonth, month.solvedLastMonth)}
          href="/ncr?status=Closed"
          accent="light"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="By category"
            subtitle={`${counts.total} records, all time`}
          />
          <CardBody>
            <DonutChart
              slices={categories}
              total={counts.total}
              centreLabel="records"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Who raises them"
            subtitle="Busiest eight, all time"
          />
          <CardBody>
            <BarChart bars={topReporters} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
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

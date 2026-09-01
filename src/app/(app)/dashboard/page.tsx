import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { DbError } from "@/components/ui/DbError";
import {
  countByStatus,
  countUnassigned,
  listNcrs,
  type NcrCounts,
} from "@/lib/repositories/ncr.repo";
import { formatDate, daysSince } from "@/lib/format";
import type { Ncr } from "@/types/ncr";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard — Operation Help" };

export default async function DashboardPage() {
  let counts: NcrCounts;
  let unassigned = 0;
  let recent: Ncr[] = [];

  try {
    [counts, unassigned, recent] = await Promise.all([
      countByStatus(),
      countUnassigned(),
      listNcrs({ limit: 6 }),
    ]);
  } catch (error) {
    return <DbError error={error} />;
  }

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
          label="Closed"
          value={counts.Closed}
          hint="Corrective action complete"
          href="/ncr?status=Closed"
        />
        <StatCard
          label="All records"
          value={counts.total}
          hint="Every record"
          href="/ncr"
          accent="light"
        />
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DbError } from "@/components/ui/DbError";
import { EmptyState } from "@/components/ui/EmptyState";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskButton } from "@/app/(app)/ncr/[id]/TaskButton";
import { CorrectiveActionForm } from "@/app/(app)/ncr/[id]/CorrectiveActionForm";
import { isSimproConfigured, simproJobUrl } from "@/lib/simpro/client";
import { getNcr } from "@/lib/repositories/ncr.repo";
import { listNcrAttachments } from "@/lib/repositories/attachment.repo";
import { listEmployees } from "@/lib/repositories/employee.repo";
import { daysSince, formatDate } from "@/lib/format";
import type { Ncr } from "@/types/ncr";
import type { NcrAttachment } from "@/lib/repositories/attachment.repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `NCR ${id} — Operation Help` };
}

export default async function NcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ncr: Ncr | null;
  let attachments: NcrAttachment[] = [];
  let staff: Map<string, string>;
  let employees: Awaited<ReturnType<typeof listEmployees>> = [];

  try {
    const [record, files, people] = await Promise.all([
      getNcr(id),
      listNcrAttachments(id),
      listEmployees(),
    ]);
    ncr = record;
    attachments = files;
    employees = people;
    staff = new Map(people.map((e) => [e.id, e.name]));
  } catch (error) {
    return <DbError error={error} />;
  }

  if (!ncr) notFound();

  /**
   * The Simpro job now comes from the NCR's own uqarSimproJobID rather than
   * being repeated on every attachment row — one link per NCR, and nothing
   * written into M1's Attachments table.
   */
  const simproJobHref =
    isSimproConfigured() && ncr.simproJobId ? simproJobUrl(ncr.simproJobId) : null;

  // Severity sits with the classification above; this block is the cost of it.
  const hasImpact = Boolean(
    ncr.actualHours > 0 || ncr.additionalCost || ncr.additionalCostDetail,
  );

  /** Employee IDs are terse ("DW"), so show the name and keep the ID beside it. */
  const person = (employeeId: string | null) => {
    if (!employeeId) return "Unassigned";
    const name = staff.get(employeeId);
    return name ? `${name} (${employeeId})` : employeeId;
  };

  return (
    <>
      <PageHeader
        title={`NCR ${ncr.id}`}
        description={
          ncr.status === "Open"
            ? `Open for ${daysSince(ncr.createdAt)} days`
            : `Closed ${formatDate(ncr.correctiveActionDate)}`
        }
        actions={
          <>
            <RefreshButton />
            {isSimproConfigured() ? (
              <TaskButton
                context={{
                  // uqarSimproJobID, not qarJobID: the latter is M1's own job
                  // number (a sales order), which means nothing to Simpro.
                  ncrId: ncr.id,
                  simproJobId: ncr.simproJobId,
                }}
              />
            ) : null}
            <Link href="/ncr">
              <Button variant="secondary">Back to list</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" subtitle="As recorded in M1" />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail label="Non-conformance ID" value={ncr.id} strong />
              <Detail
                label="Status"
                value={<Badge tone={ncr.status === "Open" ? "brand" : "ok"}>{ncr.status}</Badge>}
              />
              <Detail
                label="Category"
                value={ncr.category?.description ?? "-"}
                hint={ncr.category?.id}
              />
              <Detail
                label="Code"
                value={ncr.code?.description ?? "-"}
                hint={ncr.code?.id}
              />
              <Detail
                label="Cause"
                value={ncr.cause?.description ?? "-"}
                hint={ncr.cause?.id}
              />
              <Detail
                label="Severity"
                value={
                  ncr.severity ? (
                    <Badge tone={severityTone(ncr.severity)}>{ncr.severity}</Badge>
                  ) : (
                    "-"
                  )
                }
              />
              <Detail label="Quantity affected" value={String(ncr.quantity)} />
              <Detail label="Reported by" value={person(ncr.reportedBy)} />
              <Detail label="Assigned to" value={person(ncr.assignedTo)} />
              <Detail
                label="Part"
                value={ncr.partId ?? "-"}
                hint={ncr.partDescription ?? undefined}
              />
              <Detail label="M1 job" value={ncr.jobId ?? "-"} />
              {/*
                uqarSimproJobID, shown as a field in its own right. It used to
                appear only as a link on the attachments card, which made a
                stored value look missing — and it is the identifier a planner
                needs to read off the record.
              */}
              <Detail
                label="Simpro job"
                value={
                  ncr.simproJobId ? (
                    simproJobHref ? (
                      <a
                        href={simproJobHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-red hover:underline"
                      >
                        {ncr.simproJobId} →
                      </a>
                    ) : (
                      ncr.simproJobId
                    )
                  ) : (
                    "-"
                  )
                }
                hint={ncr.simproTaskId ? `Task ${ncr.simproTaskId}` : undefined}
              />
              <Detail
                label="Raised"
                value={formatDate(ncr.createdAt)}
                hint={ncr.createdBy ? person(ncr.createdBy) : undefined}
              />
              <Detail
                label="Corrective action date"
                value={formatDate(ncr.correctiveActionDate)}
              />
            </dl>

            {/*
              What it cost. Kept apart from the fields above because it is
              usually filled in later, and hidden entirely when nothing has
              been recorded so an NCR raised from the floor shows no empty rows.
            */}
            {hasImpact ? (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                  Impact
                </p>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {ncr.actualHours > 0 ? (
                    <Detail
                      label="Hours spent"
                      value={`${ncr.actualHours} hour${ncr.actualHours === 1 ? "" : "s"}`}
                    />
                  ) : null}
                  {ncr.additionalCost ? (
                    <Detail
                      label="Extra cost"
                      value={currency(ncr.additionalCost)}
                      hint={ncr.additionalCostDetail ?? undefined}
                    />
                  ) : null}
                  {ncr.additionalCostDetail && !ncr.additionalCost ? (
                    <Detail label="Cost detail" value={ncr.additionalCostDetail} />
                  ) : null}
                </dl>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          {/*
            The Simpro link lives on the Details card now, next to the job
            number it belongs to. Repeating it here put an identifier in a
            place nobody would look for one.
          */}
          <CardHeader
            title="Attachments"
            subtitle={`${attachments.length} file${attachments.length === 1 ? "" : "s"}`}
          />
          {attachments.length === 0 ? (
            <EmptyState message="No photos or documents on this NCR." />
          ) : (
            <ul className="divide-y divide-line">
              {attachments.map((file) => (
                <li key={file.id} className="px-5 py-3">
                  <p className="text-[13px] font-semibold break-words text-ink">
                    {file.filename || file.description}
                  </p>
                  <p className="mt-0.5 text-[12px] break-all text-ink-muted">
                    {file.location}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {formatDate(file.createdAt)}
                    {file.createdBy ? ` · ${file.createdBy}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Non-conformance" />
        <CardBody>
          <p className="text-sm whitespace-pre-wrap text-ink-body">
            {ncr.description || "No description recorded."}
          </p>
        </CardBody>
      </Card>

      <div className="mt-4">
        <CorrectiveActionForm
          ncrId={ncr.id}
          initialText={ncr.correctiveAction ?? ""}
          initialComplete={ncr.status === "Closed"}
          initialAssignedTo={ncr.assignedTo ?? ""}
          closedOn={
            ncr.correctiveActionDate ? formatDate(ncr.correctiveActionDate) : null
          }
          employees={employees}
        />
      </div>
    </>
  );
}

/** Whole dollars — M1 stores uqarNumAddCost as numeric(10,0). */
function currency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function severityTone(severity: string): "ok" | "brand" | "danger" | "graphite" {
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "brand";
    case "low":
      return "ok";
    default:
      return "graphite";
  }
}

function Detail({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${strong ? "text-lg font-extrabold text-ink" : "font-semibold text-ink"}`}
      >
        {value}
      </dd>
      {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import {
  AttachmentPicker,
  type PickedFile,
} from "@/components/ui/AttachmentPicker";
import { JobStep, type JobSelection } from "@/app/(app)/ncr/new/JobStep";
import { CreateTaskDialog } from "@/components/ui/CreateTaskDialog";
import type { Employee } from "@/lib/repositories/employee.repo";
import type { Lookup } from "@/types/ncr";

const STEPS = ["Job", "Details", "Photos", "Assign"] as const;

type Draft = JobSelection & {
  partId: string;
  categoryId: string;
  codeId: string;
  causeId: string;
  description: string;
  quantity: string;
  reportedBy: string;
  assignedTo: string;
};

const EMPTY: Draft = {
  source: "none",
  kind: "project",
  jobId: "",
  simproJobId: "",
  jobSummary: "",
  customer: "",
  customerId: null,
  site: "",
  siteId: null,
  projectManager: "",
  projectManagerId: null,
  m1SalesOrderNumber: "",
  partId: "",
  partDescription: "",
  categoryId: "",
  codeId: "",
  causeId: "",
  description: "",
  quantity: "0",
  reportedBy: "",
  assignedTo: "",
};

export function NcrWizard({
  categories,
  codes,
  causes,
  employees,
  simproConnected,
}: {
  categories: Lookup[];
  codes: Lookup[];
  causes: Lookup[];
  employees: Employee[];
  simproConnected: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextNcrId, setNextNcrId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ncrId: string;
    attachments: number;
    warnings: string[];
  } | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  /** Chosen on the last step; opens the task window once the NCR is saved. */
  const [wantTask, setWantTask] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // The number M1 will hand out, shown while filling the form. Peeked only —
  // nothing is reserved until the NCR is saved.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ncr/next-id")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.data?.nextId) setNextNcrId(body.data.nextId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the description from the job summary as soon as one is fetched, so
  // the person writes underneath the job context. Done here rather than on
  // Continue because a Simpro lookup can advance the step itself, before the
  // fetched details have been applied to the draft.
  useEffect(() => {
    if (!draft.jobSummary) return;
    setDraft((current) =>
      current.description.trim()
        ? current
        : { ...current, description: `${current.jobSummary}

` },
    );
  }, [draft.jobSummary]);

  /** Whatever is stopping this step from advancing, shown by the button. */
  const blockingError =
    step === 0
      ? (errors.simproJobId ?? errors.jobId ?? null)
      : step === 1
        ? (errors.categoryId ?? errors.description ?? null)
        : step === 3
          ? (errors.reportedBy ?? null)
          : null;

  const employeeOptions = [
    { value: "", label: "Select a person..." },
    ...employees.map((e) => ({ value: e.id, label: `${e.name} (${e.id})` })),
  ];

  function validateStep(index: number) {
    const found: Record<string, string> = {};
    if (index === 0) {
      if (draft.source === "simpro" && !draft.simproJobId.trim()) {
        found.simproJobId = "Enter a Simpro job number, or choose No job";
      }
      if (draft.source === "m1" && !draft.jobId.trim()) {
        found.jobId = "Pick an M1 job, or choose No job";
      }
    }
    if (index === 1) {
      if (!draft.categoryId) found.categoryId = "Pick a category";
      if (draft.description.trim().length < 10) {
        found.description = "Describe the non-conformance (10 characters or more)";
      }
    }
    if (index === 3 && !draft.reportedBy) {
      found.reportedBy = "Pick who reported it";
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setBanner(null);

    const form = new FormData();
    form.set("jobId", draft.jobId);
    form.set("simproJobId", draft.simproJobId);
    form.set("partId", draft.partId);
    form.set("partDescription", draft.partDescription);
    form.set("categoryId", draft.categoryId);
    form.set("codeId", draft.codeId);
    form.set("causeId", draft.causeId);
    form.set("description", draft.description);
    form.set("quantity", draft.quantity || "0");
    form.set("reportedBy", draft.reportedBy);
    form.set("assignedTo", draft.assignedTo);
    for (const item of files) form.append("attachments", item.file);

    try {
      const response = await fetch("/api/ncr", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) {
        if (body.issues) {
          const fieldErrors = Object.fromEntries(
            Object.entries(body.issues).map(([k, v]) => [
              k,
              Array.isArray(v) ? String(v[0]) : String(v),
            ]),
          );
          setErrors(fieldErrors);

          // Name the offending fields, and go back to the step holding them,
          // so the problem is in front of the person rather than described.
          const labels: Record<string, { label: string; step: number }> = {
            categoryId: { label: "Category", step: 1 },
            description: { label: "Description", step: 1 },
            partId: { label: "Part number", step: 1 },
            partDescription: { label: "Part description", step: 1 },
            quantity: { label: "Quantity affected", step: 1 },
            reportedBy: { label: "Reported by", step: 3 },
            assignedTo: { label: "Assigned to", step: 3 },
            jobId: { label: "M1 job number", step: 0 },
            simproJobId: { label: "Simpro job number", step: 0 },
          };
          const named = Object.keys(fieldErrors).map(
            (key) =>
              `${labels[key]?.label ?? key}: ${fieldErrors[key]}`,
          );
          const firstStep = Math.min(
            ...Object.keys(fieldErrors).map((k) => labels[k]?.step ?? 1),
          );
          if (Number.isFinite(firstStep)) setStep(firstStep);
          throw new Error(
            named.length
              ? `Check these fields — ${named.join("; ")}`
              : (body.error ?? "Could not save the NCR"),
          );
        }
        throw new Error(body.error ?? "Could not save the NCR");
      }
      setResult({ ...body.data, warnings: body.warnings ?? [] });
      // The reminder was asked for up front, so raise it without a second trip.
      if (wantTask && simproConnected) setTaskOpen(true);
      router.refresh();
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Card>
        <CardHeader
          title={`NCR ${result.ncrId} created in M1`}
          subtitle="The record is now in M1"
        />
        <CardBody className="space-y-4">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-3">
            <Summary label="NCR number" value={result.ncrId} />
            <Summary label="Attachments saved" value={String(result.attachments)} />
            <Summary label="Job" value={draft.simproJobId || draft.jobId || "-"} />
          </dl>

          {result.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-sm border border-warn/20 bg-warn-soft px-4 py-3 text-[13px] text-warn">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(`/ncr/${result.ncrId}`)}>
              View this NCR
            </Button>
            {simproConnected ? (
              <Button variant="secondary" onClick={() => setTaskOpen(true)}>
                Create Simpro task
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setDraft(EMPTY);
                setFiles([]);
                setStep(0);
              }}
            >
              Raise another
            </Button>
          </div>
        </CardBody>

        {taskOpen ? (
          <CreateTaskDialog
            context={{
              ncrId: result.ncrId,
              simproJobId: draft.simproJobId,
              customer: draft.customer,
              customerId: draft.customerId,
              site: draft.site,
              siteId: draft.siteId,
              suggestedAssigneeId: draft.projectManagerId,
            }}
            onClose={() => setTaskOpen(false)}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="py-4">
          <Stepper steps={STEPS} current={step} />
        </CardBody>
      </Card>

      {banner ? (
        <p className="rounded-sm border border-line bg-canvas px-4 py-2.5 text-[13px] text-ink-body">
          {banner}
        </p>
      ) : null}

      <Card>
        {step === 0 ? (
          <JobStep
            value={draft}
            onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
            onAdvance={next}
            simproConnected={simproConnected}
          />
        ) : null}

        {step === 1 ? (
          <>
            <CardHeader
              title="What went wrong"
              subtitle="Classification and description as they will appear in M1"
              action={
                nextNcrId ? (
                  <div className="text-right">
                    <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                      NCR ID
                    </p>
                    <p className="text-lg font-extrabold text-ink">{nextNcrId}</p>
                  </div>
                ) : null
              }
            />
            <CardBody className="space-y-4">
              <Field label="Description" required error={errors.description}>
                <Textarea
                  rows={7}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What is non-conforming, where it was found, and against which requirement."
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Category" required error={errors.categoryId}>
                  <Select
                    value={draft.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    options={[
                      { value: "", label: "Select..." },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: c.description || c.id,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Code">
                  <Select
                    value={draft.codeId}
                    onChange={(e) => set("codeId", e.target.value)}
                    options={[
                      { value: "", label: "Select..." },
                      ...codes.map((c) => ({
                        value: c.id,
                        label: c.description || c.id,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Cause">
                  <Select
                    value={draft.causeId}
                    onChange={(e) => set("causeId", e.target.value)}
                    options={[
                      { value: "", label: "Select..." },
                      ...causes.map((c) => ({
                        value: c.id,
                        label: c.description || c.id,
                      })),
                    ]}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Part number">
                  <Input
                    value={draft.partId}
                    onChange={(e) => set("partId", e.target.value)}
                    placeholder="SWI-UBBG-WE"
                  />
                </Field>
                <Field label="Part description">
                  <Input
                    value={draft.partDescription}
                    onChange={(e) => set("partDescription", e.target.value)}
                    maxLength={50}
                  />
                </Field>
                <Field label="Quantity affected">
                  <Input
                    type="number"
                    min={0}
                    value={draft.quantity}
                    onChange={(e) => set("quantity", e.target.value)}
                  />
                </Field>
              </div>
            </CardBody>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <CardHeader
              title="Photos and attachments"
              subtitle="Saved to the attachment share and linked to the NCR in M1"
            />
            <CardBody>
              <AttachmentPicker files={files} onChange={setFiles} />
            </CardBody>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <CardHeader
              title="Who owns it"
              subtitle="And whether to raise a Simpro task"
            />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reported by" required error={errors.reportedBy}>
                  <Select
                    value={draft.reportedBy}
                    onChange={(e) => set("reportedBy", e.target.value)}
                    options={employeeOptions}
                  />
                </Field>
                <Field label="Assigned to">
                  <Select
                    value={draft.assignedTo}
                    onChange={(e) => set("assignedTo", e.target.value)}
                    options={employeeOptions}
                  />
                </Field>
              </div>

              <div className="rounded-sm border border-line">
                <p className="border-b border-line px-4 py-2.5 text-[13px] font-bold text-ink">
                  Before you save
                </p>

                <dl className="grid gap-3 px-4 py-3 text-[13px] sm:grid-cols-4">
                  <Summary label="NCR ID" value={nextNcrId ?? "-"} />
                  <Summary
                    label="Category"
                    value={labelOf(categories, draft.categoryId)}
                  />
                  <Summary label="Part" value={draft.partId || "-"} />
                  <Summary
                    label="Job"
                    value={draft.simproJobId || draft.jobId || "-"}
                  />
                </dl>

                <div className="border-t border-line px-4 py-3">
                  <p className="text-[13px] font-bold text-ink">
                    Attachments ({files.length})
                  </p>
                  {files.length === 0 ? (
                    <p className="mt-1 text-[13px] text-ink-body">
                      None. Go back to Photos to add one.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-0.5">
                      {files.map((f) => (
                        <li key={f.id} className="truncate text-[13px] text-ink-body">
                          {f.file.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {files.length > 0 && draft.simproJobId ? (
                    <p className="mt-1.5 text-[12px] text-ink-muted">
                      Also copied to Simpro job {draft.simproJobId}, in a folder
                      named after the NCR.
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-line px-4 py-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={wantTask}
                      onChange={(e) => setWantTask(e.target.checked)}
                      disabled={!simproConnected}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-brand-red)]"
                    />
                    <span>
                      <span className="text-[13px] font-bold text-ink">
                        Raise a Simpro task as a reminder
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-body">
                        {simproConnected
                          ? "The task window opens once the NCR is saved, so someone is told to review it."
                          : "Simpro is not connected, so this is unavailable."}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </CardBody>
          </>
        ) : null}
      </Card>

      {blockingError ? (
        <p className="rounded-sm border border-danger/20 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
          {blockingError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Saving to M1..." : "Create NCR"}
          </Button>
        )}
      </div>
    </div>
  );
}

function labelOf(list: Lookup[], id: string) {
  return list.find((item) => item.id === id)?.description || "-";
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

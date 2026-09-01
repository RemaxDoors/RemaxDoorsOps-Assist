"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { M1Job } from "@/lib/repositories/job.repo";

export type JobSource = "simpro" | "m1" | "none";
export type JobKind = "service" | "project";

export type JobSelection = {
  source: JobSource;
  kind: JobKind;
  /** M1 job number written to qarJobID. */
  jobId: string;
  /** Simpro job number, used for prefill, attachments and tasks. */
  simproJobId: string;
  partId: string;
  partDescription: string;
  /** Free-text summary of the job, folded into the description. */
  jobSummary: string;
  /** Kept for the Simpro task window and for reference on the NCR. */
  customer: string;
  customerId: number | null;
  site: string;
  siteId: number | null;
  projectManager: string;
  projectManagerId: number | null;
  m1SalesOrderNumber: string;
};

export type SimproPart = {
  partNumber: string;
  description: string;
  quantity: number;
  costCentre: string | null;
};

/**
 * Step 1: where the job comes from.
 *
 * Simpro reports Service vs Project on the job itself, so that question is
 * only asked on the M1 path — where it narrows the search to M1's SERVICE or
 * PRODUCTION jobs.
 */
export function JobStep({
  value,
  onChange,
  onAdvance,
  simproConnected,
}: {
  value: JobSelection;
  onChange: (next: JobSelection) => void;
  /** Called once a Simpro job has been fetched, to move to the next step. */
  onAdvance: () => void;
  simproConnected: boolean;
}) {
  const set = <K extends keyof JobSelection>(key: K, next: JobSelection[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <CardHeader
        title="Which job is this against?"
        subtitle="Optional — an NCR can be raised without a job"
      />
      <CardBody className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-bold text-ink">
            Job reference
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <Choice
              label="Simpro job"
              hint="Look up and prefill"
              selected={value.source === "simpro"}
              onSelect={() => set("source", "simpro")}
            />
            <Choice
              label="M1 job"
              hint="Search M1 jobs"
              selected={value.source === "m1"}
              onSelect={() => set("source", "m1")}
            />
            <Choice
              label="No job"
              hint="Not job-related"
              selected={value.source === "none"}
              onSelect={() => set("source", "none")}
            />
          </div>
        </fieldset>

        {value.source === "simpro" ? (
          <SimproPanel
            value={value}
            onChange={onChange}
            onAdvance={onAdvance}
            connected={simproConnected}
          />
        ) : null}

        {value.source === "m1" ? <M1Panel value={value} onChange={onChange} /> : null}

        {value.source === "none" ? (
          <p className="rounded-sm border border-line bg-canvas px-4 py-2.5 text-[13px] text-ink-body">
            No job will be recorded against this NCR. You can still enter a part
            number on the next step.
          </p>
        ) : null}
      </CardBody>
    </>
  );
}

/* -------------------------------------------------------------- Simpro --- */

function SimproPanel({
  value,
  onChange,
  onAdvance,
  connected,
}: {
  value: JobSelection;
  onChange: (next: JobSelection) => void;
  onAdvance: () => void;
  connected: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [parts, setParts] = useState<SimproPart[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);

  async function lookup() {
    const jobId = value.simproJobId.trim();
    if (!jobId) return;

    setState("loading");
    setMessage(null);
    setParts([]);

    try {
      const response = await fetch(`/api/simpro/job/${encodeURIComponent(jobId)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Lookup failed");

      const job = body.data as {
        jobId: string;
        name: string;
        type: JobKind | null;
        customer: string | null;
        customerId: number | null;
        site: string | null;
        siteId: number | null;
        stage: string | null;
        status: string | null;
        orderNo: string | null;
        projectManager: string | null;
        projectManagerId: number | null;
        m1SalesOrderNumber: string | null;
        m1QuoteNumber: string | null;
      };

      onChange({
        ...value,
        simproJobId: job.jobId,
        // Simpro tells us the type, so it is not asked for.
        kind: job.type ?? value.kind,
        customer: job.customer ?? "",
        customerId: job.customerId,
        site: job.site ?? "",
        siteId: job.siteId,
        projectManager: job.projectManager ?? "",
        projectManagerId: job.projectManagerId,
        m1SalesOrderNumber: job.m1SalesOrderNumber ?? "",
        // The M1 sales order recorded on the Simpro job is the best starting
        // point for the M1 job number, so it is offered rather than assumed.
        jobId: value.jobId || job.m1SalesOrderNumber || "",
        jobSummary: [
          `Simpro job ${job.jobId}: ${job.name}`,
          job.customer ? `Customer: ${job.customer}` : null,
          job.site ? `Site: ${job.site}` : null,
          job.projectManager ? `Project manager: ${job.projectManager}` : null,
          job.orderNo ? `Order no: ${job.orderNo}` : null,
          job.m1SalesOrderNumber
            ? `M1 sales order: ${job.m1SalesOrderNumber}`
            : null,
          job.m1QuoteNumber ? `M1 quote: ${job.m1QuoteNumber}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      setLoaded(job.jobId);
      setMessage(
        `${job.type === "service" ? "Service" : "Project"} job · ${job.customer ?? "no customer"} · ${job.stage ?? ""} ${job.status ?? ""}`.trim(),
      );

      // Cost-centre parts, so the part number can be picked rather than typed.
      const partsResponse = await fetch(
        `/api/simpro/job/${encodeURIComponent(jobId)}/parts`,
      );
      const partsBody = await partsResponse.json();
      const found = partsResponse.ok ? (partsBody.data as SimproPart[]) : [];
      setParts(found);

      // Nothing left to choose here, so go straight on to the details.
      if (found.length === 0) onAdvance();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Simpro lookup failed");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Field label="Simpro job number" required>
            <Input
              value={value.simproJobId}
              onChange={(e) =>
                onChange({ ...value, simproJobId: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup();
                }
              }}
              placeholder="e.g. 605929"
              inputMode="numeric"
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={lookup}
          disabled={!value.simproJobId.trim() || state === "loading"}
        >
          {state === "loading" ? "Looking up..." : "Fetch job"}
        </Button>
      </div>

      {!connected ? (
        <p className="rounded-sm border border-warn/20 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          Simpro is not connected, so lookup will fail.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-sm border border-line bg-canvas px-4 py-2.5 text-[13px] text-ink-body">
          {message}
        </p>
      ) : null}

      {loaded ? (
        <>
          <dl className="grid gap-3 rounded-sm bg-canvas px-4 py-3 text-[13px] sm:grid-cols-4">
            <Summary label="Customer" value={value.customer || "-"} />
            <Summary label="Site" value={value.site || "-"} />
            <Summary label="Project manager" value={value.projectManager || "-"} />
            <Summary
              label="M1 sales order"
              value={value.m1SalesOrderNumber || "Not set on job"}
            />
          </dl>

          <Field
            label="M1 job number"
            hint={
              value.m1SalesOrderNumber
                ? `Prefilled from the job's M1SalesOrderNumber custom field (${value.m1SalesOrderNumber}). Edit if the NCR belongs to a different M1 job.`
                : "This Simpro job has no M1SalesOrderNumber custom field set."
            }
          >
            <Input
              value={value.jobId}
              onChange={(e) => onChange({ ...value, jobId: e.target.value })}
              placeholder="Leave blank if none"
            />
          </Field>
        </>
      ) : null}

      {parts.length > 0 ? (
        <div>
          <p className="mb-2 text-[13px] font-bold text-ink">
            Parts on this job ({parts.length})
          </p>
          <ul className="divide-y divide-line rounded-sm border border-line">
            {parts.map((part) => {
              const chosen = value.partId === part.partNumber;
              return (
                <li
                  key={`${part.costCentre}-${part.partNumber}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      {part.partNumber}
                    </p>
                    <p className="truncate text-[12px] text-ink-body">
                      {part.description}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      Qty {part.quantity}
                      {part.costCentre ? ` · ${part.costCentre}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={chosen ? "primary" : "secondary"}
                    onClick={() =>
                      onChange({
                        ...value,
                        partId: chosen ? "" : part.partNumber,
                        partDescription: chosen ? "" : part.description.slice(0, 50),
                      })
                    }
                  >
                    {chosen ? "Selected" : "Use part"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : loaded ? (
        <p className="text-[13px] text-ink-body">
          No catalogue parts found on this job&apos;s cost centres.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ M1 --- */

function M1Panel({
  value,
  onChange,
}: {
  value: JobSelection;
  onChange: (next: JobSelection) => void;
}) {
  const term = value.jobId;
  const [results, setResults] = useState<M1Job[]>([]);
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  // Debounced so typing a job number does not fire a query per keystroke.
  useEffect(() => {
    const search = term.trim();
    if (search.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setState("loading");
      setError(null);
      try {
        const response = await fetch(
          `/api/m1/jobs?q=${encodeURIComponent(search)}&type=${value.kind}`,
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Search failed");
        const found = body.data as M1Job[];
        setResults(found);

        const exact = found.find(
          (job) => job.jobId.toLowerCase() === search.toLowerCase(),
        );
        if (exact && !value.partId) {
          onChange({
            ...value,
            jobId: exact.jobId,
            partId: exact.partId ?? "",
            partDescription: (exact.partDescription ?? "").slice(0, 50),
            jobSummary: `M1 job ${exact.jobId}: ${exact.partDescription ?? ""}`.trim(),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setState("idle");
      }
    }, 300);

    return () => clearTimeout(timer);
    // Only re-runs on the search term and job type; `value` is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, value.kind]);

  return (
    <div className="space-y-3">
      <Field label="Job type" hint="Narrows the search to M1 SERVICE or PRODUCTION jobs">
        <Select
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as JobKind })}
          options={[
            { value: "project", label: "Project (M1 PRODUCTION)" },
            { value: "service", label: "Service (M1 SERVICE)" },
          ]}
        />
      </Field>

      <Field
        label="M1 job number"
        required
        hint="Three characters or more searches M1 jobs. Pick a result to fill in the part too."
      >
        <Input
          value={term}
          onChange={(e) => onChange({ ...value, jobId: e.target.value })}
          placeholder="e.g. 50481 or RRD-HS50"
        />
      </Field>

      {state === "loading" ? (
        <p className="text-[13px] text-ink-muted">Searching...</p>
      ) : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-sm border border-line">
          {results.map((job) => {
            const chosen = value.jobId === job.jobId;
            return (
              <li
                key={job.jobId}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{job.jobId}</p>
                  <p className="truncate text-[12px] text-ink-body">
                    {job.partId ?? "-"} · {job.partDescription ?? "no description"}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {job.customerId ?? "no customer"} · {job.type}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={chosen ? "primary" : "secondary"}
                  onClick={() =>
                    onChange({
                      ...value,
                      jobId: chosen ? term : job.jobId,
                      partId: chosen ? "" : (job.partId ?? ""),
                      partDescription: chosen
                        ? ""
                        : (job.partDescription ?? "").slice(0, 50),
                      jobSummary: chosen
                        ? ""
                        : `M1 job ${job.jobId}: ${job.partDescription ?? ""}`.trim(),
                    })
                  }
                >
                  {chosen ? "Selected" : "Use job"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : term.trim().length >= 3 && state === "idle" && !error ? (
        <p className="text-[13px] text-ink-body">
          No open {value.kind === "service" ? "service" : "production"} jobs match
          that.
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- shared --- */

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold break-words text-ink">{value}</dd>
    </div>
  );
}

function Choice({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-sm border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-brand-red bg-brand-red-soft"
          : "border-line hover:border-ink",
      )}
    >
      <span className="block text-[13px] font-bold text-ink">{label}</span>
      <span className="block text-[12px] text-ink-body">{hint}</span>
    </button>
  );
}

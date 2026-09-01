"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

/**
 * Raises a Simpro task against an NCR, mirroring Simpro's own Create Task
 * form so the fields read the same to anyone who knows that screen.
 */

export type TaskContext = {
  ncrId: string;
  /** Simpro job number — becomes Project No. on the task. */
  simproJobId?: string | null;
  customer?: string | null;
  customerId?: number | null;
  site?: string | null;
  siteId?: number | null;
  /** Pre-selected assignee, e.g. the job's project manager. */
  suggestedAssigneeId?: number | null;
};

type Staff = { id: number; name: string };

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Pending", "In Progress", "Complete"];

export function CreateTaskDialog({
  context,
  onClose,
}: {
  context: TaskContext;
  onClose: () => void;
}) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [assignedToId, setAssignedToId] = useState(
    context.suggestedAssigneeId ? String(context.suggestedAssigneeId) : "",
  );
  const [subject, setSubject] = useState(`NCR ${context.ncrId}`);
  const [description, setDescription] = useState(
    `NCR ${context.ncrId} created in M1. Please review the non-conformance and action it.`,
  );
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Pending");
  const [dueDate, setDueDate] = useState("");
  const [notify, setNotify] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    taskId: string;
    url: string;
    jobNoteId: string | null;
    jobNoteError: string | null;
    reference?: { stored: boolean; message: string | null };
  } | null>(null);

  useEffect(() => {
    fetch("/api/simpro/staff")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load staff"))))
      .then((body) => setStaff(body.data as Staff[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load staff"))
      .finally(() => setLoadingStaff(false));
  }, []);

  // Escape closes, matching every other dialog people use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!assignedToId) {
      setError("Pick who the task is assigned to");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/simpro/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          assignedToId: Number(assignedToId),
          priority,
          status,
          dueDate: dueDate || undefined,
          ncrId: context.ncrId,
          jobId: context.simproJobId || undefined,
          customerId: context.customerId ?? undefined,
          siteId: context.siteId ?? undefined,
          emailNotifications: notify,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        // A 422 means Simpro rejected a value; name the fields it objected to.
        if (response.status === 422 && body.issues) {
          const named = Object.entries(body.issues)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
            .join("; ");
          throw new Error(`Check the task details — ${named}`);
        }
        throw new Error(body.error ?? "Task creation failed");
      }
      setCreated(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task creation failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Create Simpro task"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-sm border border-line bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-ink">Create Simpro task</h2>
            <p className="mt-0.5 text-[13px] text-ink-body">
              Notifies the assignee that NCR {context.ncrId} has been raised.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-canvas"
          >
            ✕
          </button>
        </header>

        {created ? (
          <div className="space-y-4 p-5">
            <p className="rounded-sm border border-ok/20 bg-ok-soft px-4 py-3 text-[13px] text-ok">
              Task {created.taskId} created in Simpro.
              {created.jobNoteId
                ? ` A note was added to job ${context.simproJobId} so it shows there too.`
                : ""}
            </p>
            {created.reference?.message ? (
              <p className="rounded-sm border border-warn/20 bg-warn-soft px-4 py-3 text-[13px] text-warn">
                {created.reference.message}
              </p>
            ) : null}
            {created.jobNoteError ? (
              <p className="rounded-sm border border-warn/20 bg-warn-soft px-4 py-3 text-[13px] text-warn">
                The task was created, but the job note failed:{" "}
                {created.jobNoteError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a href={created.url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">Open in Simpro</Button>
              </a>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 p-5">
              <Field label="Subject" required>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={255}
                />
              </Field>

              <Field label="Description">
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Assigned to"
                  required
                  hint={loadingStaff ? "Loading staff..." : undefined}
                >
                  <Select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    disabled={loadingStaff}
                    options={[
                      { value: "", label: "Select a person..." },
                      ...staff.map((s) => ({ value: String(s.id), label: s.name })),
                    ]}
                  />
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Priority">
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    options={STATUSES.map((p) => ({ value: p, label: p }))}
                  />
                </Field>
              </div>

              {/* Carried from the job — shown so it is clear what the task links to. */}
              <div className="rounded-sm bg-canvas px-4 py-3">
                <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
                  <Detail label="Project No." value={context.simproJobId || "-"} />
                  <Detail label="Customer" value={context.customer || "-"} />
                  <Detail label="Site" value={context.site || "-"} />
                </dl>
                {context.simproJobId ? (
                  <p className="mt-2 text-[12px] text-ink-muted">
                    Simpro&apos;s API will not set Project No. on a task, so the
                    job number goes in the description and a note is added to the
                    job itself — that is what links the NCR on the job side.
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-brand-red)]"
                />
                <span className="text-[13px] text-ink">
                  Email the assignee that this task was created
                </span>
              </label>

              {error ? (
                <p className="rounded-sm border border-danger/20 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving || loadingStaff}>
                {saving ? "Creating..." : "Create task"}
              </Button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Field";
import type { Employee } from "@/lib/repositories/employee.repo";

/**
 * Records the corrective action and closes or reopens the NCR.
 *
 * This is the planner's and production manager's half of the job — until it
 * existed they had to open M1 to finish anything raised here.
 */
export function CorrectiveActionForm({
  ncrId,
  initialText,
  initialComplete,
  initialAssignedTo,
  closedOn,
  employees,
}: {
  ncrId: string;
  initialText: string;
  initialComplete: boolean;
  initialAssignedTo: string;
  closedOn: string | null;
  employees: Employee[];
}) {
  const router = useRouter();

  const [text, setText] = useState(initialText);
  const [complete, setComplete] = useState(initialComplete);
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const dirty =
    text !== initialText ||
    complete !== initialComplete ||
    assignedTo !== initialAssignedTo;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      const response = await fetch(`/api/ncr/${encodeURIComponent(ncrId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctiveAction: text,
          complete,
          assignedTo: assignedTo || "",
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        if (response.status === 422 && body.issues) {
          const first = Object.values(body.issues).flat()[0];
          throw new Error(String(first ?? body.error));
        }
        throw new Error(body.error ?? "Could not save");
      }

      setSaved(complete ? `NCR ${ncrId} closed` : "Saved");
      // Pull the server's version back so the page reflects what M1 now holds.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Corrective action"
        subtitle={
          initialComplete
            ? `Closed${closedOn ? ` on ${closedOn}` : ""}`
            : "What was done about it"
        }
        action={
          <Badge tone={initialComplete ? "ok" : "brand"}>
            {initialComplete ? "Closed" : "Open"}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <Field
          label="What was done"
          hint="Recorded in M1 against this NCR. Required before it can be closed."
        >
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Root cause, what was changed, and anything to stop it recurring."
          />
        </Field>

        <Field label="Assigned to" hint="Who owns getting this resolved">
          <Select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            options={[
              { value: "", label: "Unassigned" },
              ...employees.map((e) => ({
                value: e.id,
                label: `${e.name} (${e.id})`,
              })),
            ]}
          />
        </Field>

        <label className="flex items-start gap-3 rounded-sm border border-line p-4">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand-red)]"
          />
          <span>
            <span className="text-[13px] font-bold text-ink">
              Corrective action complete
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-body">
              {complete
                ? "This NCR counts as solved from today."
                : "Leave unticked while work is outstanding. Unticking a closed NCR reopens it."}
            </span>
          </span>
        </label>

        {error ? (
          <p className="rounded-sm border border-danger/20 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-sm border border-ok/20 bg-ok-soft px-4 py-2.5 text-[13px] text-ok">
            {saved}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving
              ? "Saving..."
              : complete && !initialComplete
                ? "Save and close NCR"
                : "Save"}
          </Button>
          {dirty && !saving ? (
            <span className="text-[12px] text-ink-muted">Unsaved changes</span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

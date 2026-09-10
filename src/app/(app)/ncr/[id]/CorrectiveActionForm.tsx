"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Field";
import type { Employee } from "@/lib/repositories/employee.repo";
import { messageFor, RequestError } from "@/lib/http";

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
  initialResponse,
  initialSignedOff,
  initialSignedOffBy,
  signedOffOn,
  responseAvailable,
  signOffAvailable,
  closedOn,
  employees,
}: {
  ncrId: string;
  initialText: string;
  initialComplete: boolean;
  initialAssignedTo: string;
  initialResponse: string;
  initialSignedOff: boolean;
  initialSignedOffBy: string;
  signedOffOn: string | null;
  /** Whether M1 has the column behind each field — see m1/M1-Setup.md. */
  responseAvailable: boolean;
  signOffAvailable: boolean;
  closedOn: string | null;
  employees: Employee[];
}) {
  const router = useRouter();

  const [text, setText] = useState(initialText);
  const [complete, setComplete] = useState(initialComplete);
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
  const [ncrResponse, setNcrResponse] = useState(initialResponse);
  const [signedOff, setSignedOff] = useState(initialSignedOff);
  const [signedOffBy, setSignedOffBy] = useState(initialSignedOffBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  /**
   * Sign-off follows the corrective action, so it cannot be reached until one
   * is recorded and ticked complete. Unticking complete withdraws the sign-off
   * with it — leaving an approval attached to work that has reopened would say
   * something untrue about the record.
   *
   * Derived rather than pushed into state: the tick a person made is still
   * remembered, so re-ticking complete restores it instead of silently losing
   * it.
   */
  const canSignOff = signOffAvailable && complete && text.trim().length > 0;
  const effectiveSignedOff = signedOff && canSignOff;

  const dirty =
    text !== initialText ||
    complete !== initialComplete ||
    assignedTo !== initialAssignedTo ||
    ncrResponse !== initialResponse ||
    effectiveSignedOff !== initialSignedOff ||
    signedOffBy !== initialSignedOffBy;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      let response: Response;
      try {
        response = await fetch(`/api/ncr/${encodeURIComponent(ncrId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            correctiveAction: text,
            complete,
            assignedTo: assignedTo || "",
            response: ncrResponse,
            signedOff: effectiveSignedOff,
            signedOffBy: effectiveSignedOff ? signedOffBy : "",
          }),
        });
      } catch {
        // No response at all: offline, or bounced to a sign-in page.
        throw new RequestError(
          "Could not reach the server, so nothing was saved. Reload the page and try again.",
          null,
        );
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new RequestError(
            "Your sign-in has expired, so nothing was saved. Reload the page and try again.",
            response.status,
          );
        }
        if (response.status === 422 && body?.issues) {
          const first = Object.values(body.issues).flat()[0];
          throw new Error(String(first ?? body.error));
        }
        throw new Error(body?.error ?? "Could not save");
      }

      setSaved(complete ? `NCR ${ncrId} closed` : "Saved");
      // Pull the server's version back so the page reflects what M1 now holds.
      router.refresh();
    } catch (e) {
      setError(messageFor(e, "Could not save."));
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

        <div className="space-y-4 border-t border-line pt-4">
          {/*
            A missing column is skipped by the write rather than failing it, so
            without this the fields would accept input, save without complaint,
            and come back empty. Saying so is the only honest option.
          */}
          {!responseAvailable || !signOffAvailable ? (
            <p className="rounded-sm border border-warn/20 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
              {responseAvailable || signOffAvailable
                ? "Some of the fields below are not yet set up in M1, so they cannot be saved."
                : "Response and sign-off are not yet set up in M1, so they cannot be saved."}{" "}
              Ask whoever manages M1 to add the columns in m1/M1-Setup.md — the
              System page lists which are missing.
            </p>
          ) : null}

          {responseAvailable ? (
            <Field
              label="NCR response / notes"
              hint="Anything said back once the corrective action was recorded — the customer's reply, a follow-up, or a note for the next person."
            >
              <Textarea
                rows={4}
                value={ncrResponse}
                onChange={(e) => setNcrResponse(e.target.value)}
                placeholder="Response received, follow-up agreed, or notes for whoever picks this up next."
              />
            </Field>
          ) : null}

          {signOffAvailable ? (
          <label
            className={`flex items-start gap-3 rounded-sm border border-line p-4 ${
              canSignOff ? "" : "opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={effectiveSignedOff}
              disabled={!canSignOff}
              onChange={(e) => setSignedOff(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-brand-red)]"
            />
            <span>
              <span className="text-[13px] font-bold text-ink">Signed off</span>
              <span className="mt-0.5 block text-[13px] text-ink-body">
                {canSignOff
                  ? "Approves the corrective action. The date is stamped by the server when this is saved."
                  : "Available once the corrective action is written and ticked complete."}
              </span>
            </span>
          </label>
          ) : null}

          {effectiveSignedOff ? (
            <Field label="Signed off by" hint="Who is approving it">
              <Select
                value={signedOffBy}
                onChange={(e) => setSignedOffBy(e.target.value)}
                options={[
                  { value: "", label: "Select a person..." },
                  ...employees.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.id})`,
                  })),
                ]}
              />
            </Field>
          ) : null}

          {initialSignedOff && signedOffOn ? (
            <p className="text-[12px] text-ink-muted">
              Signed off on {signedOffOn}. Editing the wording does not change
              that date.
            </p>
          ) : null}
        </div>

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

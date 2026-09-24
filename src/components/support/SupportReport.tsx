"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { getJson } from "@/lib/http";
import {
  sessionLog,
  subscribeToLog,
  type LogEntry,
} from "@/lib/support/sessionLog";
import {
  SUPPORT_EMAIL,
  buildMailBody,
  buildReport,
  mailtoUrl,
} from "@/lib/support/report";

type Health = {
  database: { ok: boolean; configured: boolean; error: string | null };
  simpro: { ok: boolean; configured: boolean; error: string | null };
};
type Whoami = { session: { name: string; email: string } | null };
type Queue = { data: { pending: number; failed: number } };

type Checks = {
  signedInAs: string | null;
  m1: string;
  simpro: string;
  queue: string;
};

const CHECKING: Checks = {
  signedInAs: null,
  m1: "checking...",
  simpro: "checking...",
  queue: "checking...",
};

function describeService(
  service: { ok: boolean; configured: boolean; error: string | null } | undefined,
): string {
  if (!service) return "could not be checked";
  if (service.ok) return "reachable";
  if (!service.configured) return `not configured — ${service.error ?? ""}`.trim();
  return `not reachable — ${service.error ?? "no reason given"}`;
}

export function SupportReport({ version }: { version: string }) {
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<Checks>(CHECKING);
  const [log, setLog] = useState<readonly LogEntry[]>(sessionLog());
  const [copied, setCopied] = useState(false);

  // Redraw as failures arrive, so a fault that happens while the page is open
  // appears without a reload.
  useEffect(() => subscribeToLog(() => setLog([...sessionLog()])), []);

  useEffect(() => {
    let cancelled = false;

    /**
     * Each check stands alone: one failing service must not leave the other
     * answers blank, because "which of these is broken" is the question.
     */
    const run = async () => {
      const [who, health, queue] = await Promise.all([
        getJson<Whoami>("/api/whoami").catch(() => null),
        getJson<Health>("/api/health").catch(() => null),
        getJson<Queue>("/api/queue").catch(() => null),
      ]);

      if (cancelled) return;

      setChecks({
        signedInAs: who?.session?.name ?? null,
        m1: describeService(health?.database),
        simpro: describeService(health?.simpro),
        queue: queue
          ? `${queue.data.pending} waiting, ${queue.data.failed} failed`
          : "could not be checked",
      });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const input = {
    note,
    reportedBy: checks.signedInAs,
    version,
    page: typeof window === "undefined" ? "" : window.location.href,
    checks: [
      { label: "Signed in as", value: checks.signedInAs ?? "not signed in" },
      { label: "M1", value: checks.m1 },
      { label: "Simpro", value: checks.simpro },
      { label: "Waiting for M1", value: checks.queue },
    ],
    log,
  };

  const subject = `NCR support: ${note.trim().slice(0, 60) || "an issue"}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(input));
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The email route still works, and the
      // report is on screen to select by hand.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="What is happening right now"
          subtitle="Checked when this page opened"
        />
        <CardBody>
          <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
            <Row label="Signed in as" value={checks.signedInAs ?? "not signed in"} />
            <Row label="App version" value={version} />
            <Row label="M1" value={checks.m1} />
            <Row label="Simpro" value={checks.simpro} />
            <Row label="Waiting for M1" value={checks.queue} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Report a problem"
          subtitle={`Opens an email to ${SUPPORT_EMAIL} with everything below already filled in`}
        />
        <CardBody className="space-y-4">
          <Field
            label="What were you doing, and what happened?"
            hint="In your own words. This is the most useful part of the report."
          >
            <Textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="I filled in the NCR for job 605787, pressed Save, and a red message said..."
            />
          </Field>

          <div className="rounded-sm border border-line px-4 py-3">
            <p className="text-[13px] font-bold text-ink">
              Please attach a screenshot or a short video
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] text-ink-body">
              <li>
                A picture of the whole screen, including any red message, is
                usually enough to find the cause.
              </li>
              <li>
                On Windows: press Windows + Shift + S, drag over the screen, then
                paste into the email with Ctrl + V.
              </li>
              <li>
                On a phone: take a screenshot, or record the screen if it only
                goes wrong while you are tapping, and attach the file.
              </li>
              <li>
                Attach it to the email this page opens — a web page cannot
                attach files for you.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={mailtoUrl(subject, buildMailBody(input))}>
              <Button>Email this report</Button>
            </a>
            <Button variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy report"}
            </Button>
          </div>
          <p className="text-[12px] text-ink-muted">
            Nothing is sent until you press Send in your own email. If the draft
            looks cut short, use Copy report and paste it in instead.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Errors in this tab"
          subtitle="Held only while this tab is open, and cleared when it closes"
        />
        <CardBody>
          {log.length === 0 ? (
            <p className="text-[13px] text-ink-body">
              Nothing has failed in this tab. If the problem happened before you
              opened this page, describe it above — the list starts again each
              time the app is reloaded.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...log].reverse().map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className="flex flex-wrap items-baseline gap-2 text-[13px]"
                >
                  <span className="tabular-nums text-ink-muted">
                    {new Date(entry.at).toLocaleTimeString("en-AU")}
                  </span>
                  <Badge tone={entry.kind === "error" ? "danger" : "warn"}>
                    {entry.kind}
                  </Badge>
                  <span className="text-ink-body">{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-ink-muted">
            Passwords, sign-in tokens and anything typed into a form are never
            recorded here or included in the report.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

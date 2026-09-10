"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Compares what the server saw when it rendered this page against what it sees
 * for a fetch made from the same page.
 *
 * These are two separate HTTP requests, and the whole class of "it says my
 * sign-in expired but my name is right there at the top" comes from them
 * disagreeing. Nothing in the browser shows that, so it is measured here.
 *
 * The verdict is the point: it names which of the two requests lost the
 * identity, because that decides whether the fix is in Easy Auth, in the
 * cookie, or in this app.
 */

type Whoami = {
  platformIdentity: { principalName: string | null; principalIdPresent: boolean };
  sessionCookieSent: boolean;
  session: { name: string; email: string } | null;
  platform: { authEnabled: string | null; trust: { basis: string } };
};

type Outcome =
  | { kind: "checking" }
  | { kind: "redirected" }
  | { kind: "refused"; status: number }
  | { kind: "unreadable"; detail: string }
  | { kind: "ok"; body: Whoami };

export function IdentityCheck({
  /** What the server saw while rendering this page. */
  renderedFor,
}: {
  renderedFor: string | null;
}) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "checking" });

  const check = useCallback(async () => {
    setOutcome({ kind: "checking" });
    try {
      const response = await fetch("/api/whoami", {
        cache: "no-store",
        redirect: "manual",
      });

      // A bounce to the identity provider. The request never reached the app.
      if (response.type === "opaqueredirect") {
        return setOutcome({ kind: "redirected" });
      }
      if (response.status === 401 || response.status === 403) {
        return setOutcome({ kind: "refused", status: response.status });
      }
      if (!response.ok) {
        return setOutcome({
          kind: "unreadable",
          detail: `The app returned ${response.status}.`,
        });
      }
      setOutcome({ kind: "ok", body: (await response.json()) as Whoami });
    } catch (error) {
      setOutcome({
        kind: "unreadable",
        detail:
          error instanceof Error ? error.message : "The request did not complete.",
      });
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const fetchName =
    outcome.kind === "ok" ? outcome.body.platformIdentity.principalName : null;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Identity check"
        subtitle="What the page render saw, against what a fetch from this page sees"
        action={
          <Button variant="secondary" onClick={check}>
            Check again
          </Button>
        }
      />
      <CardBody className="space-y-4 text-[13px]">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row
            label="This page was rendered for"
            value={renderedFor ?? "nobody — no identity on the page request"}
            good={Boolean(renderedFor)}
          />
          <Row
            label="A fetch from this page is seen as"
            value={describe(outcome)}
            good={Boolean(fetchName)}
          />
        </dl>

        {outcome.kind === "ok" ? (
          <dl className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Row
              label="Session cookie sent"
              value={outcome.body.sessionCookieSent ? "Yes" : "No"}
              good={outcome.body.sessionCookieSent}
            />
            <Row
              label="Platform auth"
              value={outcome.body.platform.authEnabled ?? "not reported"}
              good={outcome.body.platform.authEnabled === "true"}
            />
            <Row
              label="Header trust"
              value={outcome.body.platform.trust.basis}
              good={outcome.body.platform.trust.basis === "verified"}
            />
          </dl>
        ) : null}

        <Verdict renderedFor={renderedFor} outcome={outcome} />
      </CardBody>
    </Card>
  );
}

function describe(outcome: Outcome): string {
  switch (outcome.kind) {
    case "checking":
      return "checking...";
    case "redirected":
      return "sent to the Microsoft sign-in page";
    case "refused":
      return `refused with ${outcome.status}`;
    case "unreadable":
      return outcome.detail;
    case "ok":
      return outcome.body.platformIdentity.principalName ?? "nobody — anonymous";
  }
}

/**
 * The whole reason this card exists. Each combination has one cause and one
 * fix, and saying which removes the guesswork from a bug report.
 */
function Verdict({
  renderedFor,
  outcome,
}: {
  renderedFor: string | null;
  outcome: Outcome;
}) {
  if (outcome.kind === "checking") return null;

  const signedInOnPage = Boolean(renderedFor);
  const signedInOnFetch =
    outcome.kind === "ok" && Boolean(outcome.body.platformIdentity.principalName);

  if (signedInOnPage && signedInOnFetch) {
    return (
      <Note tone="ok">
        Both requests carry the same identity. Sign-in is working, and any
        &quot;sign-in expired&quot; message is reporting something else.
      </Note>
    );
  }

  if (signedInOnPage && outcome.kind === "redirected") {
    return (
      <Note tone="danger">
        The page has your identity but a fetch from it is being sent to the
        sign-in page. App Service is refusing the call before the app sees it —
        the app itself no longer checks. Set Authentication to &quot;Allow
        unauthenticated access&quot;.
      </Note>
    );
  }

  if (signedInOnPage && !signedInOnFetch) {
    return (
      <Note tone="danger">
        The page has your identity and the fetch does not, so the session cookie
        is not travelling with background requests. Whether it was sent at all
        is shown above, and that decides it: not sent means the browser is
        withholding it, sent means App Service rejected it.
      </Note>
    );
  }

  return (
    <Note tone="warn">
      This page rendered without an identity, so the sign-in did not complete
      rather than lapsing later. Sign out fully and back in, and say whether you
      were offered a choice of two Microsoft accounts.
    </Note>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    ok: "border-ok/20 bg-ok-soft text-ok",
    warn: "border-warn/20 bg-warn-soft text-warn",
    danger: "border-danger/20 bg-danger-soft text-danger",
  }[tone];
  return (
    <p className={`rounded-sm border px-4 py-3 text-[13px] ${styles}`}>{children}</p>
  );
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 font-semibold break-words ${good ? "text-ink" : "text-danger"}`}
      >
        {value}
      </dd>
    </div>
  );
}

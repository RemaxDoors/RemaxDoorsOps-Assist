"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Blocks a form while M1 is unreachable, so nobody types out an NCR that
 * cannot be saved. Simpro being down is only a warning — an NCR can still be
 * raised without it.
 */

type Service = { ok: boolean; configured: boolean; error: string | null };
type Health = {
  database: Service;
  simpro: Service;
  ok: boolean;
  checkedAt: string;
};

export function ServiceGuard({
  children,
  requireSimpro = false,
}: {
  children: React.ReactNode;
  /** Set when the page is useless without Simpro. */
  requireSimpro?: boolean;
}) {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok && response.status !== 200) {
        throw new Error(`The app returned ${response.status}`);
      }
      setHealth(await response.json());
      setUnreachable(null);
    } catch (error) {
      // The app itself is unreachable — dev server stopped, network dropped.
      setUnreachable(
        error instanceof Error ? error.message : "Could not reach the server",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (checking && !health) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-[13px] text-ink-body">
          Checking connections...
        </CardBody>
      </Card>
    );
  }

  if (unreachable) {
    return (
      <Problem
        title="Cannot reach Operation Help"
        detail={unreachable}
        onRetry={check}
        checking={checking}
      />
    );
  }

  if (health && !health.database.ok) {
    return (
      <Problem
        title="M1 is unavailable"
        detail={health.database.error ?? "The M1 database did not respond."}
        hint="Nothing can be saved until M1 is back, so the form is closed to prevent losing what you type."
        onRetry={check}
        checking={checking}
        checkedAt={health.checkedAt}
      />
    );
  }

  if (health && requireSimpro && !health.simpro.ok) {
    return (
      <Problem
        title="Simpro is unavailable"
        detail={health.simpro.error ?? "Simpro did not respond."}
        onRetry={check}
        checking={checking}
        checkedAt={health.checkedAt}
      />
    );
  }

  return (
    <>
      {health && health.simpro.configured && !health.simpro.ok ? (
        <p className="mb-4 rounded-sm border border-warn/20 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          Simpro is not responding, so job lookup and tasks will fail. You can
          still raise an NCR. {health.simpro.error}
        </p>
      ) : null}
      {children}
    </>
  );
}

function Problem({
  title,
  detail,
  hint,
  onRetry,
  checking,
  checkedAt,
}: {
  title: string;
  detail: string;
  hint?: string;
  onRetry: () => void;
  checking: boolean;
  checkedAt?: string;
}) {
  /**
   * Opens the user's mail client with the fault already written up. A link
   * rather than an automatic send: the app has no mailbox of its own, and
   * nothing should leave without the person seeing it first.
   */
  const mailto = () => {
    const body = [
      "Operation Help reported a problem.",
      "",
      `Problem: ${title}`,
      `Detail: ${detail}`,
      `Checked at: ${checkedAt ?? new Date().toISOString()}`,
      `Page: ${typeof window === "undefined" ? "" : window.location.href}`,
      "",
      "Raised from the Operation Help error screen.",
    ].join("\n");

    return `mailto:?subject=${encodeURIComponent(
      `Operation Help: ${title}`,
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Card>
      <CardHeader title={title} subtitle="The form is unavailable until this clears" />
      <CardBody className="space-y-4">
        <p className="rounded-sm border border-danger/20 bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {detail}
        </p>
        {hint ? <p className="text-[13px] text-ink-body">{hint}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} disabled={checking}>
            {checking ? "Checking..." : "Try again"}
          </Button>
          <a href={mailto()}>
            <Button variant="secondary">Report by email</Button>
          </a>
        </div>
        {checkedAt ? (
          <p className="text-[12px] text-ink-muted">
            Last checked {new Date(checkedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/** Shown when a page cannot reach M1 — the message names the missing piece. */
export function DbError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";

  return (
    <Card>
      <CardHeader
        title="Cannot reach the M1 database"
        subtitle="The page could not load its data"
      />
      <CardBody className="space-y-3">
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
          {message}
        </p>
        <p className="text-[13px] text-ink-muted">
          Check <code className="text-ink">DB_SERVER</code>,{" "}
          <code className="text-ink">DB_NAME</code>,{" "}
          <code className="text-ink">DB_USER</code> and{" "}
          <code className="text-ink">DB_PASSWORD</code> in{" "}
          <code className="text-ink">.env.local</code>, then restart the dev
          server. Connection status:{" "}
          <a className="text-brand-red hover:underline" href="/api/health/db">
            /api/health/db
          </a>
        </p>
      </CardBody>
    </Card>
  );
}

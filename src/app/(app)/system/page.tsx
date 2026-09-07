import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { StatCard } from "@/components/ui/StatCard";
import { runDiagnostics, type Check, type CheckStatus } from "@/lib/diagnostics/checks";

export const dynamic = "force-dynamic";

export const metadata = { title: "System check — Operation Help" };

const TONE: Record<CheckStatus, "ok" | "warn" | "danger"> = {
  pass: "ok",
  warn: "warn",
  fail: "danger",
};

const WORD: Record<CheckStatus, string> = {
  pass: "Pass",
  warn: "Check",
  fail: "Fail",
};

/**
 * Runs the checks in whichever environment served the page.
 *
 * That is the whole point: opened on Azure it reports Azure, opened locally it
 * reports the laptop. Several answers — is the share writable, is the platform
 * attaching identity headers, does this database have that column — differ
 * between the two and cannot be established from the other side.
 */
export default async function SystemPage() {
  const result = await runDiagnostics();

  // Preserve the order the checks were produced in; it runs cheapest first.
  const groups = result.checks.reduce<Map<string, Check[]>>((acc, check) => {
    const existing = acc.get(check.group);
    if (existing) existing.push(check);
    else acc.set(check.group, [check]);
    return acc;
  }, new Map());

  return (
    <>
      <PageHeader
        title="System check"
        description={`${result.checks.length} checks in ${result.ms}ms · ${new Date(
          result.ranAt,
        ).toLocaleString("en-AU")}`}
        actions={<RefreshButton />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Passing" value={String(result.summary.pass)} />
        <StatCard label="Needs a look" value={String(result.summary.warn)} />
        <StatCard label="Failing" value={String(result.summary.fail)} />
      </div>

      <div
        className={`mb-4 rounded-sm border px-4 py-3 text-[13px] ${
          result.ok
            ? "border-ok/20 bg-ok-soft text-ok"
            : "border-danger/20 bg-danger-soft text-danger"
        }`}
      >
        {result.ok
          ? result.summary.warn > 0
            ? "Everything needed is working. The items marked Check are optional features that are not configured."
            : "Everything is working."
          : "Something needed is not working. The failing checks below say what and why."}
      </div>

      <div className="space-y-4">
        {[...groups.entries()].map(([group, checks]) => (
          <Card key={group}>
            <CardHeader
              title={group}
              action={
                checks.some((c) => c.status === "fail") ? (
                  <Badge tone="danger">Failing</Badge>
                ) : checks.some((c) => c.status === "warn") ? (
                  <Badge tone="warn">Check</Badge>
                ) : (
                  <Badge tone="ok">Pass</Badge>
                )
              }
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {checks.map((check) => (
                  <li
                    key={check.id}
                    className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <div className="sm:w-24 sm:shrink-0">
                      <Badge tone={TONE[check.status]}>{WORD[check.status]}</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold break-words text-ink">
                        {check.label}
                      </p>
                      <p className="mt-0.5 text-[13px] break-words text-ink-body">
                        {check.detail}
                      </p>
                    </div>
                    {check.ms !== undefined ? (
                      <span className="text-[12px] text-ink-muted tabular-nums sm:w-16 sm:text-right">
                        {check.ms}ms
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Logs"
          subtitle="Application output is streamed by the platform, not stored here"
        />
        <CardBody className="space-y-2 text-[13px] text-ink-body">
          <p>
            Live output is in the Azure portal under{" "}
            <span className="font-semibold text-ink">
              App Service → Monitoring → Log stream
            </span>
            . Sign-in problems and Simpro failures are written there with an{" "}
            <code className="text-ink">[auth]</code> or{" "}
            <code className="text-ink">[simpro]</code> prefix.
          </p>
          <p>
            These checks are also available as JSON at{" "}
            <code className="text-ink">/api/system</code>, which answers 200 when
            nothing is failing and 503 when something is — so a monitor can watch
            it without reading the page.
          </p>
        </CardBody>
      </Card>
    </>
  );
}

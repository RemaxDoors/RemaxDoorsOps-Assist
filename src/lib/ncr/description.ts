import "server-only";

/**
 * The one place an NCR description is assembled.
 *
 * It was being built in the browser, in the wizard's job step, which meant the
 * timestamp and the author would both have come from the client — neither can
 * be trusted, and the author is exactly the field someone would want to forge.
 * Everything here runs on the server.
 *
 * Structured identifiers are deliberately absent. The Simpro job goes in
 * uqarSimproJobID, the task in uqarSimproTaskID and the author in
 * uqarReportedBy; repeating them in prose gives two sources of truth that
 * drift, and makes them unqueryable. Only context a person reads belongs here.
 */

export type JobContext = {
  name?: string | null;
  customer?: string | null;
  site?: string | null;
  orderNo?: string | null;
  projectManager?: string | null;
  m1QuoteNumber?: string | null;
};

/**
 * Australian format, and explicitly Melbourne rather than the server's clock —
 * App Service runs UTC, so an NCR raised at 9am would otherwise read 23:00 the
 * previous day to the person who raised it.
 */
export function formatAudit(when: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(when);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get(
    "minute",
  )} ${get("timeZoneName")}`;
}

function contextLines(job: JobContext | null | undefined): string[] {
  if (!job) return [];
  return [
    job.name ? `Job Name: ${job.name}` : null,
    job.customer ? `Customer: ${job.customer}` : null,
    job.site ? `Site: ${job.site}` : null,
    job.orderNo ? `Order No: ${job.orderNo}` : null,
    job.projectManager ? `Project Manager: ${job.projectManager}` : null,
    job.m1QuoteNumber ? `M1 Quote: ${job.m1QuoteNumber}` : null,
  ].filter((line): line is string => Boolean(line));
}

/**
 * Job context, then what the person actually wrote, then who and when.
 *
 * `author` must come from the platform identity, never from the form.
 */
export function buildDescription({
  issue,
  job,
  author,
  now = new Date(),
}: {
  issue: string;
  job?: JobContext | null;
  author: string;
  now?: Date;
}): string {
  const blocks: string[] = [];

  const context = contextLines(job);
  if (context.length) blocks.push(context.join("\n"));

  blocks.push(`Issue: ${issue.trim()}`);
  blocks.push(`---\nEntry added: ${formatAudit(now)}\nUser: ${author}`);

  return blocks.join("\n\n");
}

/**
 * Appends a dated note, leaving what is already there untouched.
 *
 * Unused until the question in REVIEW.md is settled — whether
 * qarNonConformanceText is one editable description or a running log. It lives
 * here so that decision changes one call site rather than being reinvented.
 */
export function appendEntry({
  existing,
  addition,
  author,
  now = new Date(),
}: {
  existing: string;
  addition: string;
  author: string;
  now?: Date;
}): string {
  return `${existing.trimEnd()}\n\n---\nUpdate: ${formatAudit(
    now,
  )}\nUser: ${author}\n\n${addition.trim()}`;
}

import type { LogEntry } from "@/lib/support/sessionLog";

/**
 * Where fault reports go.
 *
 * Hard-coded as asked, with an override so it can be pointed at a shared
 * support inbox from App Service settings later without a code change or a
 * redeploy. NEXT_PUBLIC_ because the address is used in the browser to build
 * the mail draft.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "gzmerel@gmail.com";

export type ReportInput = {
  /** What the person says happened. Their words are the most useful field. */
  note: string;
  /** Who is reporting, when the app knows. Never taken from a text box. */
  reportedBy: string | null;
  version: string;
  page: string;
  checks: Array<{ label: string; value: string }>;
  log: readonly LogEntry[];
};

/**
 * Practical ceiling for a mailto body. Outlook and the platform both cut long
 * ones, and a report that arrives truncated is worse than one that says it was
 * shortened — hence the Copy button on the page for the full version.
 */
const MAILTO_BUDGET = 1600;

function lines(input: ReportInput, log: readonly LogEntry[]): string[] {
  return [
    `Reported by: ${input.reportedBy ?? "not signed in"}`,
    `Reported at: ${new Date().toISOString()}`,
    `Version: ${input.version}`,
    `Page: ${input.page}`,
    "",
    "What happened:",
    input.note.trim() || "(not described)",
    "",
    "Checks at the time of reporting:",
    ...input.checks.map((check) => `  ${check.label}: ${check.value}`),
    "",
    log.length
      ? `Errors seen in this tab (${log.length}):`
      : "Errors seen in this tab: none",
    ...log.map((entry) => `  ${entry.at} ${entry.kind}: ${entry.message}`),
    "",
    "Screenshot or video: please attach it to this email before sending.",
  ];
}

/** The whole report, for the clipboard. */
export function buildReport(input: ReportInput): string {
  return lines(input, input.log).join("\n");
}

/**
 * The report trimmed to fit a mail draft, oldest log entries dropped first.
 * Says so when it has dropped any, so nobody reads a short list as a clean one.
 */
export function buildMailBody(input: ReportInput): string {
  let log = input.log;
  let body = lines(input, log).join("\n");

  while (body.length > MAILTO_BUDGET && log.length > 0) {
    log = log.slice(1);
    body = [
      ...lines(input, log),
      "",
      `(${input.log.length - log.length} older entries omitted — use "Copy report" on the Support page for all of them.)`,
    ].join("\n");
  }

  return body;
}

export function mailtoUrl(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

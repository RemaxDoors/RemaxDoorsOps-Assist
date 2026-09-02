/**
 * Tells "M1 is unreachable" apart from "M1 rejected this".
 *
 * Only the first is worth queueing: a connectivity fault will pass, so holding
 * the submission is useful. A constraint violation or bad value would fail
 * identically on every retry, and queueing it would just hide the problem.
 */
const CONNECTIVITY = [
  "ELOGIN",
  "ETIMEOUT",
  "ETIMEDOUT",
  "ESOCKET",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTOPEN",
  "EPIPE",
];

export function isDatabaseUnreachable(error: unknown): boolean {
  if (!error) return false;

  const code = (error as { code?: string }).code;
  if (code && CONNECTIVITY.includes(code)) return true;

  const message = error instanceof Error ? error.message : String(error);
  if (/not configured|Missing in \.env\.local/i.test(message)) return true;

  return new RegExp(`\b(${CONNECTIVITY.join("|")})\b`, "i").test(message)
    || /connection is closed|failed to connect|socket hang up/i.test(message);
}

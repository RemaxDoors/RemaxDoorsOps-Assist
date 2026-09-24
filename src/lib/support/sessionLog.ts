/**
 * What went wrong in this browser tab.
 *
 * The app has no log store and no request ids yet, so when someone says "it
 * broke" there is nothing to look at. This is the browser's half of that
 * answer: a short list, held in memory, of the failures this tab saw. It is
 * deliberately not the server's half — that needs the logging and request-id
 * work, and once it exists the two can be tied together by the same id.
 *
 * In memory on purpose. Written to sessionStorage it would outlive the fault
 * and start reporting yesterday's problem, and it would be one more place a
 * fragment of someone's work could sit on a shared machine.
 *
 * WHAT NEVER GOES IN HERE: cookies, tokens, and anything typed into a form.
 * A support report that quietly mailed a half-written NCR description to
 * someone's inbox would be a privacy fault of its own, and the bug is almost
 * never in the text that was typed. Status codes, routes and error messages
 * are what diagnoses a fault.
 */

export type LogKind = "request" | "error";

export type LogEntry = {
  at: string;
  kind: LogKind;
  message: string;
};

/** Enough to cover a session's worth of faults, short enough to read. */
const MAX_ENTRIES = 60;
/** A stack trace pasted whole makes the report unreadable and unmailable. */
const MAX_MESSAGE = 240;

const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

export function logEvent(kind: LogKind, message: string) {
  entries.push({
    at: new Date().toISOString(),
    kind,
    message: message.slice(0, MAX_MESSAGE),
  });
  // Drop the oldest rather than the newest: the last thing to fail is usually
  // the thing being reported.
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  for (const listener of listeners) listener();
}

export function sessionLog(): readonly LogEntry[] {
  return entries;
}

export function subscribeToLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let installed = false;

/**
 * Catches the two failures that otherwise leave no trace: a script error, and
 * a promise nobody handled. Installed once, from the app shell.
 */
export function installGlobalLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    logEvent("error", event.message || "Script error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logEvent(
      "error",
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection",
    );
  });
}

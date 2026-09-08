/**
 * Fetch helpers for client components.
 *
 * Two jobs. The first is to say what went wrong: `fetch` rejects with a bare
 * TypeError — "Failed to fetch" — both when the network is down and when the
 * platform answers with a cross-origin redirect, so the browser's own text
 * distinguishes nothing.
 *
 * The second is to recover a lapsed sign-in. App Service sessions expire
 * (measured at roughly 75 minutes), and the two request kinds then diverge:
 * a page navigation is redirected to /.auth/login/aad, completes SSO silently
 * because Microsoft still has the user, and lands back looking fine — while a
 * background fetch cannot follow a cross-origin redirect and simply fails.
 * The result was a wizard that said "Not signed in" to somebody who had signed
 * in minutes earlier and whose next page load would have worked.
 *
 * So a 401 now sends the browser through that same silent round trip instead
 * of reporting it. Expiry becomes a reload rather than an error.
 */

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

const SIGNED_OUT =
  "Your sign-in has expired. Reload the page to sign in again, then try once more.";
const UNREACHABLE =
  "Could not reach the server. Check your connection and try again.";

/**
 * Sends the browser to App Service's sign-in, returning to the current page.
 *
 * Guarded twice. `reauthenticating` stops several parallel calls each starting
 * a navigation — the NCR wizard fires a job lookup and a parts lookup together,
 * and two redirects race. The sessionStorage stamp stops a redirect loop: if
 * coming back from sign-in still yields a 401, something is wrong that another
 * round trip will not fix, so the message is shown instead.
 */
let reauthenticating = false;
const ATTEMPT_KEY = "ops_reauth_attempt";
const ATTEMPT_WINDOW_MS = 30_000;

function recentlyAttempted(): boolean {
  try {
    const last = Number(sessionStorage.getItem(ATTEMPT_KEY) ?? 0);
    return Date.now() - last < ATTEMPT_WINDOW_MS;
  } catch {
    // Private windows can throw on access; treat as "no record" and allow one
    // attempt rather than blocking recovery entirely.
    return false;
  }
}

function markAttempt() {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()));
  } catch {
    // Nothing to do — the in-memory guard still prevents a redirect storm
    // within this page load.
  }
}

/** True when the browser is being sent to sign in, so callers can stay quiet. */
function reauthenticate(): boolean {
  if (typeof window === "undefined") return false;
  if (reauthenticating || recentlyAttempted()) return false;

  reauthenticating = true;
  markAttempt();

  const returnTo = window.location.pathname + window.location.search;
  window.location.assign(
    `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`,
  );
  return true;
}

/** Cleared once a call succeeds, so a later expiry can recover again. */
function clearAttempt() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // Ignored: the stamp expires on its own after ATTEMPT_WINDOW_MS.
  }
}

async function readError(response: Response): Promise<string> {
  // A sign-in page is HTML, not JSON: reading it as JSON throws, and the raw
  // markup must never reach the user.
  const body = await response.json().catch(() => null);
  const described = body && typeof body.error === "string" ? body.error : null;

  if (response.status === 401 || response.status === 403) {
    return described ?? SIGNED_OUT;
  }

  // 422 carries per-field detail; naming the fields saves the user hunting
  // through the form for what the server objected to.
  if (response.status === 422 && body?.issues) {
    const named = Object.entries(body.issues as Record<string, unknown>)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
      .join("; ");
    if (named) return `${described ?? "Check the details"} — ${named}`;
  }

  return described ?? `The server returned an error (${response.status}).`;
}

/**
 * Whether a lapsed sign-in should be recovered by navigating, or reported.
 *
 * Reads recover: nothing is lost by replacing the page, and the user gets
 * their data instead of an error. Writes report: the person has typed an NCR
 * and attached photos, and navigating away to fix a session would throw that
 * work away to save them a click. Losing the report is worse than losing the
 * session.
 */
type RequestOptions = { recoverSignIn: boolean };

async function request<T>(
  url: string,
  init?: RequestInit,
  { recoverSignIn }: RequestOptions = { recoverSignIn: true },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // TypeError from fetch: no response at all. Either genuinely offline, or
    // the platform bounced us cross-origin to a login page.
    throw new RequestError(UNREACHABLE, null);
  }

  /**
   * A lapsed sign-in, in its two shapes: our own 401, or a redirect the page
   * cannot read because it points at the identity provider. Both are
   * recoverable, so recover rather than report.
   *
   * When the navigation starts, this promise is left unresolved on purpose —
   * the page is being replaced, and settling it would flash an error at
   * somebody who is already on their way to being signed back in.
   */
  const signedOut =
    response.status === 401 ||
    response.type === "opaqueredirect" ||
    response.redirected;

  if (signedOut && recoverSignIn && reauthenticate()) {
    return new Promise<T>(() => {});
  }

  if (!response.ok) {
    throw new RequestError(await readError(response), response.status);
  }

  // The call worked, so any earlier expiry is behind us and the next one
  // should be allowed to recover in turn.
  clearAttempt();

  return (await response.json()) as T;
}

/** Reads recover a lapsed sign-in silently. */
export function getJson<T>(url: string): Promise<T> {
  return request<T>(url);
}

/** Writes report it instead, so nothing typed is thrown away. */
export function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { recoverSignIn: false },
  );
}

/** The message to show for any error thrown by the helpers above. */
export function messageFor(error: unknown, fallback: string): string {
  if (error instanceof RequestError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

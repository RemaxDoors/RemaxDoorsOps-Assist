/**
 * Fetch helpers for client components.
 *
 * One job: say what went wrong. `fetch` rejects with a bare TypeError —
 * "Failed to fetch" — both when the network is down and when the platform
 * answers with a cross-origin redirect, so the browser's own text
 * distinguishes nothing.
 *
 * This deliberately does NOT try to re-establish a sign-in. It did briefly,
 * by calling window.location.assign() on a 401 to send the browser through a
 * silent round trip. That started a navigation the browser then took its time
 * completing, and while it was pending every subsequent fetch on the page
 * failed with "Failed to fetch" — including ones that would have succeeded.
 * A page that looked fine became permanently unable to load anything, and
 * reloading re-triggered it. Measured on the deployed app: /api/health
 * returned 200 on a fresh tab and threw on a tab where the redirect had
 * fired.
 *
 * Reporting a lapsed sign-in and letting the person reload is worse UX and
 * strictly better behaviour. Keeping the session alive is the real fix, and
 * belongs somewhere that cannot break the page when it misfires.
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
 * Clears the stamp the removed auto-navigation left behind.
 *
 * A browser that ran the previous build still holds it in sessionStorage.
 * Nothing reads it any more, so this only stops it lingering for the life of
 * the tab; it is not load-bearing.
 */
function clearStaleReauthStamp() {
  try {
    sessionStorage.removeItem("ops_reauth_attempt");
  } catch {
    // Private windows can refuse storage. Nothing depends on this.
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    /**
     * redirect: "manual" is what makes a lapsed sign-in reportable.
     *
     * App Service answers an unauthenticated call with a 302 to
     * login.microsoftonline.com. Followed, that is a cross-origin request the
     * page may not read, so fetch rejects with a bare TypeError and the only
     * thing left to say is "could not reach the server" — which blames the
     * network for what is actually an expired session.
     *
     * Left unfollowed it arrives as an opaqueredirect we can recognise, and
     * the person gets told the one thing that fixes it: reload.
     */
    response = await fetch(url, { redirect: "manual", ...init });
  } catch {
    // TypeError from fetch: genuinely no response — offline, or the connection
    // dropped mid-request.
    throw new RequestError(UNREACHABLE, null);
  }

  /**
   * A redirect the page cannot read points at the identity provider, so it
   * means the same thing as a 401. Reported, not acted on — see the note at
   * the top of this file.
   */
  if (response.type === "opaqueredirect" || response.redirected) {
    throw new RequestError(SIGNED_OUT, response.status);
  }

  if (!response.ok) {
    throw new RequestError(await readError(response), response.status);
  }

  clearStaleReauthStamp();

  return (await response.json()) as T;
}

export function getJson<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The message to show for any error thrown by the helpers above. */
export function messageFor(error: unknown, fallback: string): string {
  if (error instanceof RequestError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

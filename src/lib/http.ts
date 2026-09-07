/**
 * Fetch helpers for client components.
 *
 * The browser's own failure text is unhelpful in this app's two most common
 * failure modes. `fetch` rejects with a bare TypeError — surfaced as "Failed to
 * fetch" — both when the network is down and when the platform answers with a
 * cross-origin redirect to a sign-in page, which is what App Service does to an
 * expired session. Neither tells the person what to do, and the second is not
 * even a network problem.
 *
 * So: never show a raw fetch error. Work out which of the three it is —
 * unreachable, signed out, or an error the server actually described — and say
 * so.
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
    response = await fetch(url, init);
  } catch {
    // TypeError from fetch: no response at all. Either genuinely offline, or
    // the platform bounced us cross-origin to a login page.
    throw new RequestError(UNREACHABLE, null);
  }

  // An opaque redirect means we were sent somewhere the page cannot read —
  // in practice, the identity provider.
  if (response.type === "opaqueredirect" || response.redirected) {
    throw new RequestError(SIGNED_OUT, response.status);
  }

  if (!response.ok) {
    throw new RequestError(await readError(response), response.status);
  }

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

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasValidApiKey } from "@/lib/auth/apiKey";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * Identity comes from App Service Authentication ("Easy Auth"), not from this
 * app.
 *
 * App Service performs the Entra sign-in at the platform edge and forwards the
 * result as headers. That removes the OAuth flow, the client secret and the
 * signed session cookie from this codebase entirely — the three things that
 * were failing — and hands session lifetime, token refresh and sign-out to the
 * platform.
 *
 * The trade is that nothing here works without App Service in front of it, so
 * local development relies on AUTH_DEV_BYPASS.
 */

/** Set by App Service on every authenticated request. */
const PRINCIPAL_NAME = "x-ms-client-principal-name";
const PRINCIPAL_ID = "x-ms-client-principal-id";
/** Base64 JSON carrying the full claim set. */
const PRINCIPAL = "x-ms-client-principal";

export type Session = {
  /** Entra object id. */
  sub: string;
  name: string;
  email: string;
};

type Principal = {
  auth_typ?: string;
  claims?: Array<{ typ?: string; val?: string }>;
};

/**
 * Claim names differ between token versions and providers, so each field is
 * looked up under every name Entra is known to use rather than one.
 */
const NAME_CLAIMS = [
  "name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
];
const EMAIL_CLAIMS = [
  "preferred_username",
  "email",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
];

function claim(principal: Principal | null, names: string[]): string | null {
  for (const name of names) {
    const found = principal?.claims?.find((c) => c.typ === name)?.val;
    if (found) return found;
  }
  return null;
}

function decodePrincipal(encoded: string | null): Principal | null {
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString()) as Principal;
  } catch {
    // A malformed header is not worth failing a request over — the name and
    // id headers alone are enough to identify the user.
    return null;
  }
}

/** Current signed-in user, or null. Safe to call from any server component. */
export async function getSession(): Promise<Session | null> {
  const store = await headers();

  const principalName = store.get(PRINCIPAL_NAME);
  const principalId = store.get(PRINCIPAL_ID);

  if (!principalName && !principalId) {
    return isDevBypass() ? devSession() : null;
  }

  /**
   * Headers alone are not proof. They are only meaningful because App Service
   * Authentication strips any a client sent and re-issues its own; with the
   * feature off, anyone could claim to be anyone. See lib/auth/platform.ts.
   */
  if (onAppService() && !identityTrust().trusted) return null;

  const principal = decodePrincipal(store.get(PRINCIPAL));
  const email = claim(principal, EMAIL_CLAIMS) ?? principalName ?? "";

  return {
    sub: principalId ?? email ?? "unknown",
    // Falls back to the email so the top bar never shows an empty name.
    name: claim(principal, NAME_CLAIMS) ?? principalName ?? email ?? "Ops user",
    email,
  };
}

/**
 * Identity for an API request, or null.
 *
 * Route handlers must use this rather than requireSession(). requireSession()
 * calls redirect(), which in a route handler becomes a 307 to the sign-in page
 * — so an API caller got HTML-ish redirect instead of JSON, and a browser
 * fetch followed it cross-origin and failed with an opaque "Failed to fetch".
 * Measured: POST /api/ncr with a valid API key answered 303 to
 * /.auth/login/aad, which is why the key could read but never write.
 *
 * A valid API key is an identity in its own right — machine callers (M1 forms,
 * Power BI) have no user behind them — but it is deliberately not a person, so
 * anything recorded against it is attributable to "API" rather than to whoever
 * last held the key.
 */
export async function apiActor(headers_: Headers): Promise<Session | null> {
  const session = await getSession();
  if (session) return session;
  if (hasValidApiKey(headers_)) return API_ACTOR;
  return null;
}

const API_ACTOR: Session = { sub: "api", name: "API", email: "" };

/** Use in protected pages: returns the session or sends the user to sign in. */
export async function requireSession(returnTo = "/dashboard"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(signInUrl(returnTo));
  return session;
}

/**
 * App Service's own sign-in endpoint. It is served before the app is reached,
 * so it needs no route here.
 */
export function signInUrl(returnTo = "/dashboard") {
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`;
}

export function signOutUrl(returnTo = "/") {
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(returnTo)}`;
}

/**
 * Development escape hatch: App Service is not in front of `next dev`, so
 * there are no principal headers and nobody could sign in at all.
 * Opt-in via AUTH_DEV_BYPASS=true in .env.local; ignored in production builds.
 */
export function isDevBypass() {
  return (
    process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "true"
  );
}

export function devSession(): Session {
  return {
    sub: "dev",
    name: "Dev User",
    email: "dev@remaxdoors.local",
  };
}

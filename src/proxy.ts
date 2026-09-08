import { NextResponse, type NextRequest } from "next/server";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * A backstop, not an authentication system.
 *
 * Named `proxy` because Next 16 renamed the middleware convention; the
 * behaviour is unchanged.
 *
 * App Service Authentication is the boundary: it signs the user in before the
 * request reaches this app and attaches the result as headers. With "Require
 * authentication" it also refuses anonymous requests at the edge, so in normal
 * operation nothing here ever fires.
 *
 * It is kept for the case where that stops being true. Easy Auth is one toggle
 * in a portal blade; if it is disabled or misconfigured, requests arrive with
 * no identity and this app would otherwise serve M1 quality data to anyone who
 * has the URL. Refusing costs one header read per request and turns a silent
 * exposure into a visible failure.
 *
 * There is no login logic here, no session, no API key, and no token. The only
 * decision is: identity present, or not.
 */

/** Set by App Service on every authenticated request. */
const PRINCIPAL_NAME = "x-ms-client-principal-name";
const PRINCIPAL_ID = "x-ms-client-principal-id";

/**
 * Paths this app does not gate itself.
 *
 * /api/health — so monitoring can reach it.
 *
 * /api/simpro/job — the Add NCR wizard's job lookup. It was gated here as
 * well as at the platform, and that duplication was the source of the "Not
 * signed in" failures: a lapsed session still let the page render, while the
 * background lookup was refused. One gate is enough.
 *
 * Both lean entirely on App Service Authentication being set to *require*
 * authentication. While it allows unauthenticated access, these paths answer
 * anyone with the URL — and the job lookup proxies Simpro with the server's
 * token, so it would serve job details to the internet. The token itself
 * never leaves the server either way.
 *
 * Exclude the same paths in App Service (Authentication → excluded paths) if
 * the health probe must keep working once that switch is made.
 */
const PUBLIC_PREFIXES = ["/api/health", "/api/simpro/job"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSignedIn(request: NextRequest) {
  // Headers are only believable while App Service Authentication is enabled to
  // strip client-supplied ones — see lib/auth/platform.ts.
  if (onAppService() && !identityTrust().trusted) return false;

  return Boolean(
    request.headers.get(PRINCIPAL_NAME) ?? request.headers.get(PRINCIPAL_ID),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // `next dev` has no App Service in front of it, so there are no identity
  // headers and nobody could sign in at all. Ignored in production builds.
  if (process.env.AUTH_DEV_BYPASS === "true") return NextResponse.next();

  if (isSignedIn(request)) return NextResponse.next();

  // An API caller gets JSON it can read. Redirecting would send a browser
  // fetch cross-origin to a login page, where CORS makes it an opaque
  // "Failed to fetch" with no status and nothing to act on.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401 },
    );
  }

  // A person gets sent to App Service's own sign-in, which returns them here.
  const returnTo = `${pathname}${search}`;
  return NextResponse.redirect(
    new URL(
      `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`,
      request.url,
    ),
  );
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ncr/:path*",
    "/system/:path*",
    "/api-docs/:path*",
    "/api/:path*",
  ],
};

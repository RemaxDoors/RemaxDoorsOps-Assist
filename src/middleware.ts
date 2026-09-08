import { NextResponse, type NextRequest } from "next/server";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * A backstop, not an authentication system.
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
 * The health probe stays open so monitoring can reach it. Exclude the same
 * path in App Service (Authentication → excluded paths) or the platform will
 * refuse it before this is consulted.
 */
const PUBLIC_PREFIXES = ["/api/health"];

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

export function middleware(request: NextRequest) {
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

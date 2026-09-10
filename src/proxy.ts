import { NextResponse, type NextRequest } from "next/server";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * A backstop on pages, not an authentication system.
 *
 * Named `proxy` because Next 16 renamed the middleware convention; the
 * behaviour is unchanged.
 *
 * App Service Authentication is the boundary: it signs the user in before the
 * request reaches this app and attaches the result as headers. In normal
 * operation nothing here ever fires. It is kept for the case where that stops
 * being true — Easy Auth is one toggle in a portal blade, and if it is
 * disabled the app would otherwise serve M1 quality data to anyone with the
 * URL. Refusing costs one header read and turns a silent exposure into a
 * visible failure.
 *
 * Pages only. API routes are deliberately not gated here, and that is the
 * point of this file's current shape: signing in happens once, when a person
 * opens a page. Re-checking on every fetch that page then makes is what
 * produced the "Not signed in" and "Could not reach the server" reports — the
 * page was open and filled in, but its background calls were being refused by
 * a second gate the person had no way to satisfy without losing their work.
 *
 * That leaves App Service as the only gate on /api/*. While it is set to
 * require authentication it still answers those calls itself, before this app
 * runs — see the Easy Auth note in docs, and excludedPaths.
 */

/** Set by App Service on every authenticated request. */
const PRINCIPAL_NAME = "x-ms-client-principal-name";
const PRINCIPAL_ID = "x-ms-client-principal-id";

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

  // `next dev` has no App Service in front of it, so there are no identity
  // headers and nobody could sign in at all. Ignored in production builds.
  if (process.env.AUTH_DEV_BYPASS === "true") return NextResponse.next();

  if (isSignedIn(request)) return NextResponse.next();

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
  ],
};

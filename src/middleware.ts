import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Gate for pages and API routes.
 *
 * Two ways in:
 *   - a session cookie, for people using the app in a browser;
 *   - an X-API-Key header, for programmatic callers (M1, Power BI, scripts).
 *
 * The cookie's signature is verified server-side by requireSession(); this
 * only checks that one is present, which is enough to bounce anonymous traffic.
 */

/** Open endpoints: sign-in itself, and the health probe used by monitoring. */
const PUBLIC_PREFIXES = ["/api/auth", "/api/health"];

/**
 * Matches the prefix itself as well as anything beneath it. `/api/health` is
 * the probe App Service is pointed at, and a trailing-slash-only prefix would
 * have answered it with a 401 — an instance permanently marked unhealthy.
 */
function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasValidApiKey(request: NextRequest) {
  const expected = process.env.API_KEY;
  if (!expected) return false;

  const provided =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  // Length check first so the comparison below cannot be used as a length oracle.
  if (!provided || provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  // An API key is accepted on API routes only — never as a way into the UI.
  if (isApi && hasValidApiKey(request)) return NextResponse.next();

  if (process.env.AUTH_DEV_BYPASS === "true") return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (isApi) {
    return NextResponse.json(
      { error: "Unauthorized. Send a valid X-API-Key header, or sign in." },
      { status: 401 },
    );
  }

  const landing = new URL("/", request.url);
  landing.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(landing);
}

export const config = {
  matcher: ["/dashboard/:path*", "/ncr/:path*", "/api-docs/:path*", "/api/:path*"],
};

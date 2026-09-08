import { NextResponse, type NextRequest } from "next/server";
import { hasValidApiKey } from "@/lib/auth/apiKey";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * Gate for pages and API routes.
 *
 * Sign-in itself belongs to App Service Authentication, which runs before this
 * app is reached and attaches the signed-in user as headers. This only decides
 * what to do when those headers are absent:
 *
 *   - a person is sent to App Service's own sign-in endpoint;
 *   - a programmatic caller (M1, Power BI, scripts) may present an API key.
 *
 * App Service must be configured to *allow* unauthenticated requests through.
 * Setting it to "require authentication" would have the platform reject
 * everything at the edge, which also blocks the health probe and every API-key
 * caller — neither of which can complete an interactive sign-in.
 */

/** Set by App Service on every authenticated request. */
const PRINCIPAL_NAME = "x-ms-client-principal-name";
const PRINCIPAL_ID = "x-ms-client-principal-id";
/** The base64 claims blob; present whenever the platform authenticated. */
const PRINCIPAL = "x-ms-client-principal";

/**
 * Open endpoints: the health probe used by monitoring, and the identity
 * diagnostic — which has to answer for an anonymous request to be any use,
 * and returns only booleans.
 */
const PUBLIC_PREFIXES = ["/api/health", "/api/whoami"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isSignedIn(request: NextRequest) {
  // Same rule as getSession(): the headers are only believable while App
  // Service Authentication is enabled to strip client-supplied ones.
  if (onAppService() && !identityTrust().trusted) return false;

  return Boolean(
    request.headers.get(PRINCIPAL_NAME) ?? request.headers.get(PRINCIPAL_ID),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  // An API key is accepted on API routes only — never as a way into the UI.
  if (isApi && hasValidApiKey(request.headers)) return NextResponse.next();

  if (process.env.AUTH_DEV_BYPASS === "true") return NextResponse.next();
  if (isSignedIn(request)) return NextResponse.next();

  if (isApi) {
    /**
     * The booleans that decided this, returned with the refusal.
     *
     * Reading them from a log stream means correlating a timestamp with a
     * click; putting them in the body means whoever hit the error can see why
     * in the same breath. All derived, none of them a value: no header
     * contents, no key material, nothing that helps an attacker who could not
     * already send these headers.
     */
    return NextResponse.json(
      {
        error: "Unauthorized. Send a valid X-API-Key header, or sign in.",
        diagnostics: {
          path: pathname,
          hasClientPrincipal: Boolean(request.headers.get(PRINCIPAL)),
          hasPrincipalName: Boolean(request.headers.get(PRINCIPAL_NAME)),
          hasPrincipalId: Boolean(request.headers.get(PRINCIPAL_ID)),
          hasApiKey: Boolean(
            request.headers.get("x-api-key") ?? request.headers.get("authorization"),
          ),
          apiKeyValid: hasValidApiKey(request.headers),
          apiKeyConfigured: Boolean(process.env.API_KEY),
          identityTrusted: onAppService() ? identityTrust().trusted : null,
          onAppService: onAppService(),
        },
      },
      { status: 401 },
    );
  }

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

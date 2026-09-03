import { NextResponse } from "next/server";
import { appUrl, exchangeCode, safeReturnTo } from "@/lib/auth/entra";
import {
  SESSION_COOKIE,
  encodeSession,
  sessionCookieOptions,
  sessionLifetimeSeconds,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = (message: string) =>
    NextResponse.redirect(
      appUrl(`/?error=${encodeURIComponent(message)}`, request),
    );

  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) return failure(error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.match(/ops_oauth_state=([^;]+)/)?.[1];
  const verifier = request.headers
    .get("cookie")
    ?.match(/ops_oauth_verifier=([^;]+)/)?.[1];
  const returnTo = request.headers
    .get("cookie")
    ?.match(/ops_oauth_return=([^;]+)/)?.[1];

  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return failure("Sign-in could not be verified. Please try again.");
  }

  try {
    const claims = await exchangeCode({ code, codeVerifier: verifier });
    const response = NextResponse.redirect(
      appUrl(safeReturnTo(returnTo), request),
    );

    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({
        sub: claims.oid ?? claims.sub ?? "unknown",
        name: claims.name ?? claims.preferred_username ?? "Ops user",
        email: claims.preferred_username ?? claims.email ?? "",
        exp: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds(),
      }),
      sessionCookieOptions(),
    );

    for (const name of ["ops_oauth_state", "ops_oauth_verifier", "ops_oauth_return"]) {
      response.cookies.delete(name);
    }
    return response;
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Sign-in failed");
  }
}

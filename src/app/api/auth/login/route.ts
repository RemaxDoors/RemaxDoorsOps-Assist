import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/auth/entra";

export const dynamic = "force-dynamic";

/** Starts the Microsoft sign-in redirect, stashing state + PKCE verifier. */
export async function GET(request: Request) {
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/dashboard";
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  try {
    const response = NextResponse.redirect(
      authorizeUrl({ state, codeChallenge: challenge }),
    );
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    };
    response.cookies.set("ops_oauth_state", state, options);
    response.cookies.set("ops_oauth_verifier", verifier, options);
    response.cookies.set("ops_oauth_return", returnTo, options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}

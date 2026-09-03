import { NextResponse } from "next/server";
import { appUrl, isAuthConfigured, signOutUrl } from "@/lib/auth/entra";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = isAuthConfigured() ? signOutUrl() : appUrl("/", request);
  const response = NextResponse.redirect(target);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

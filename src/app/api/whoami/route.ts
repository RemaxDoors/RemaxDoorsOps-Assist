import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { identityTrust, onAppService } from "@/lib/auth/platform";

export const dynamic = "force-dynamic";

/**
 * What identity did the server receive on *this* request.
 *
 * A page render and a fetch from that page are two separate HTTP requests. The
 * page can show a name while a fetch from the same tab is refused, and from
 * inside the browser the two are indistinguishable — both just "the app". This
 * reports what arrived, so the two can be compared instead of guessed at.
 *
 * Deliberately reports presence, never values, for anything sensitive: the
 * session cookie and the principal blob are confirmed as present or absent and
 * never echoed. The name and email are already shown in the app's own top bar,
 * so repeating them here reveals nothing new.
 */
export async function GET() {
  const store = await headers();
  const cookie = store.get("cookie") ?? "";
  const session = await getSession();

  return NextResponse.json({
    /** What App Service attached to this request, if anything. */
    platformIdentity: {
      principalName: store.get("x-ms-client-principal-name"),
      principalIdPresent: Boolean(store.get("x-ms-client-principal-id")),
      principalBlobPresent: Boolean(store.get("x-ms-client-principal")),
    },
    /**
     * Whether the browser sent the Easy Auth session cookie at all. This is the
     * question that separates "the session expired" from "the cookie never
     * arrived" — two faults with completely different fixes.
     */
    sessionCookieSent: cookie.includes("AppServiceAuthSession"),
    /**
     * Names and sizes only, never values.
     *
     * Every unauthenticated request App Service bounces to the login page is
     * answered with a fresh Nonce cookie. A page that pulls sub-resources the
     * platform refuses — the manifest and the icons are requested without
     * credentials, so it always refuses those — collects one per load. They
     * accumulate, the Cookie header grows, and past a limit the session cookie
     * stops arriving intact. Counting them is the only way to see that happen.
     */
    cookies: {
      count: cookie ? cookie.split(";").filter((c) => c.trim()).length : 0,
      headerBytes: cookie.length,
      names: cookie
        .split(";")
        .map((c) => c.split("=")[0]?.trim())
        .filter((n): n is string => Boolean(n))
        .slice(0, 60),
    },
    /** What the app made of it. Null means the app sees an anonymous caller. */
    session: session ? { name: session.name, email: session.email } : null,
    platform: {
      onAppService: onAppService(),
      authEnabled: process.env.WEBSITE_AUTH_ENABLED ?? null,
      trust: identityTrust(),
    },
    at: new Date().toISOString(),
  });
}

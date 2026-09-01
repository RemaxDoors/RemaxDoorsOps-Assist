import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

const MAX_AGE_SECONDS = 60 * 60 * 8; // one working day

export type Session = {
  /** Entra object id */
  sub: string;
  name: string;
  email: string;
  /** epoch seconds */
  exp: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of 32+ chars");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** payload.signature, both base64url. */
export function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Session;
    return session.exp * 1000 > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function sessionLifetimeSeconds() {
  return MAX_AGE_SECONDS;
}

/** Current signed-in user, or null. Safe to call from any server component. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (session) return session;
  return isDevBypass() ? devSession() : null;
}

/** Use in protected pages: returns the session or sends the user to sign in. */
export async function requireSession(returnTo = "/dashboard"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/?returnTo=${encodeURIComponent(returnTo)}`);
  return session;
}

/**
 * Development escape hatch so the UI is usable before Entra ID is registered.
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
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
}

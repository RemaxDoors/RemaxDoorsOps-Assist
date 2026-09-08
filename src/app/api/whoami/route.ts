import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { hasValidApiKey } from "@/lib/auth/apiKey";
import { identityTrust, onAppService } from "@/lib/auth/platform";
import { getSession, isDevBypass } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * What this request looks like to the authentication layer.
 *
 * Exists because the two layers see different things and we kept guessing
 * which one was rejecting: page navigations were working while browser
 * fetch() calls got a 401, and no amount of reading the code settles whether
 * the identity headers actually arrive on a given request.
 *
 * Deliberately public, so it can answer the anonymous case too — there is no
 * point in a diagnostic that only works once you are already past the gate.
 *
 * Booleans and labels only. No header values, no claims, no key material:
 * everything here is safe to paste into a chat or a ticket.
 */
export async function GET() {
  const store = await headers();
  const session = await getSession();
  const trust = identityTrust();

  const hasPrincipal = Boolean(store.get("x-ms-client-principal"));
  const hasPrincipalName = Boolean(store.get("x-ms-client-principal-name"));
  const hasPrincipalId = Boolean(store.get("x-ms-client-principal-id"));
  const apiKeyPresent = Boolean(
    store.get("x-api-key") ?? store.get("authorization"),
  );

  return NextResponse.json({
    authenticated: Boolean(session),
    actorType: session
      ? isDevBypass() && !hasPrincipalName
        ? "dev-bypass"
        : "entra"
      : hasValidApiKey(store)
        ? "api-key"
        : "anonymous",
    displayNamePresent: Boolean(session?.name),

    // Which headers arrived. The three are set independently by the platform,
    // so knowing which are missing narrows the cause.
    headers: {
      clientPrincipal: hasPrincipal,
      clientPrincipalName: hasPrincipalName,
      clientPrincipalId: hasPrincipalId,
    },

    apiKey: {
      // Whether one was sent at all, and separately whether it matched. A key
      // present but invalid is a very different problem from none sent.
      present: apiKeyPresent,
      valid: hasValidApiKey(store),
      configured: Boolean(process.env.API_KEY),
    },

    platform: {
      onAppService: onAppService(),
      identityTrusted: trust.trusted,
      identityBasis: trust.basis,
      devBypass: isDevBypass(),
    },
  });
}

import "server-only";

/**
 * Microsoft Entra ID (Azure AD) authorization-code flow with PKCE.
 * Sign-in is browser-redirect only: the app never sees a user's password.
 */

const SCOPES = "openid profile email offline_access";

export function entraConfig() {
  return {
    tenantId: process.env.AZURE_AD_TENANT_ID,
    clientId: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    baseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  };
}

export function isAuthConfigured() {
  const { tenantId, clientId, clientSecret } = entraConfig();
  return Boolean(tenantId && clientId && clientSecret && process.env.AUTH_SECRET);
}

type ResolvedConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

function requireConfig(): ResolvedConfig {
  const { tenantId, clientId, clientSecret, baseUrl } = entraConfig();
  const missing: string[] = [];
  if (!tenantId) missing.push("AZURE_AD_TENANT_ID");
  if (!clientId) missing.push("AZURE_AD_CLIENT_ID");
  if (!clientSecret) missing.push("AZURE_AD_CLIENT_SECRET");
  if (missing.length) {
    throw new Error(
      `Microsoft sign-in is not configured. Missing in .env.local: ${missing.join(", ")}`,
    );
  }
  return { tenantId: tenantId!, clientId: clientId!, clientSecret: clientSecret!, baseUrl };
}

export function redirectUri() {
  return new URL("/api/auth/callback", entraConfig().baseUrl).toString();
}

export function authorizeUrl({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}) {
  const { tenantId, clientId } = requireConfig();
  const url = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type EntraClaims = {
  oid?: string;
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};

export async function exchangeCode({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<EntraClaims> {
  const { tenantId, clientId, clientSecret } = requireConfig();

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
        code_verifier: codeVerifier,
        scope: SCOPES,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Entra did not return an id_token");
  return decodeIdToken(tokens.id_token);
}

/**
 * The id_token comes straight from the token endpoint over TLS, in response to
 * our own client-authenticated request, so the claims are read directly rather
 * than re-verified against the JWKS.
 */
function decodeIdToken(idToken: string): EntraClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed id_token");
  return JSON.parse(Buffer.from(payload, "base64url").toString()) as EntraClaims;
}

export function signOutUrl() {
  const { tenantId, baseUrl } = entraConfig();
  const url = new URL(
    `https://login.microsoftonline.com/${tenantId ?? "common"}/oauth2/v2.0/logout`,
  );
  url.searchParams.set("post_logout_redirect_uri", new URL("/", baseUrl).toString());
  return url.toString();
}

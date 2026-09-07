/**
 * API key check, shared by the edge middleware and the route handlers.
 *
 * Deliberately free of node-only imports so middleware can use it, and pure so
 * both layers reach the same verdict — a gate that disagrees with itself is
 * worse than one gate.
 */
export function hasValidApiKey(headers: Headers): boolean {
  const expected = process.env.API_KEY;
  if (!expected) return false;

  const provided =
    headers.get("x-api-key") ??
    headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  // Length first, so the comparison below cannot be used as a length oracle.
  if (!provided || provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

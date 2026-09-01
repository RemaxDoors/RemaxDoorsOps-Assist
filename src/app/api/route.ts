import { NextResponse } from "next/server";
import { apiEndpoints } from "@/config/apiEndpoints";

export const dynamic = "force-dynamic";

/** Machine-readable index of the API. */
export async function GET(request: Request) {
  const base = new URL(request.url).origin;

  return NextResponse.json({
    name: "Operation Help API",
    version: "1.0",
    baseUrl: base,
    authentication: {
      header: "X-API-Key",
      note: "Or sign in with Microsoft and use the session cookie from a browser.",
    },
    endpoints: apiEndpoints.map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      url: `${base}${endpoint.path}`,
      summary: endpoint.summary,
      group: endpoint.group,
      auth: endpoint.auth,
      params: endpoint.params ?? [],
    })),
  });
}

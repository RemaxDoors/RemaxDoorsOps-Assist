import { headers } from "next/headers";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { EndpointCard } from "@/app/(app)/api-docs/EndpointCard";
import { apiEndpoints, type ApiEndpoint } from "@/config/apiEndpoints";

export const dynamic = "force-dynamic";

export const metadata = { title: "API — Operation Help" };

const GROUPS: ApiEndpoint["group"][] = ["NCR", "M1", "Simpro", "System"];

export default async function ApiDocsPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:4080";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  return (
    <>
      <PageHeader
        title="API"
        description="Call Operation Help from M1, Power BI, scripts or anything else that speaks HTTP."
      />

      <Card className="mb-4">
        <CardHeader title="Getting started" />
        <CardBody className="space-y-4 text-[13px] text-ink-body">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
              Base URL
            </p>
            <code className="mt-1 block text-sm font-bold text-ink">{baseUrl}</code>
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
              Authentication
            </p>
            <p className="mt-1">
              Send your key as an <code className="text-ink">X-API-Key</code>{" "}
              header (an <code className="text-ink">Authorization: Bearer</code>{" "}
              header works too). The key is the{" "}
              <code className="text-ink">API_KEY</code> value in{" "}
              <code className="text-ink">.env.local</code> — treat it like a
              password and keep it out of anything shared.
            </p>
            <p className="mt-1">
              Requests from a signed-in browser are accepted without a key,
              which is how the “Try it” buttons below work.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
              Responses
            </p>
            <p className="mt-1">
              JSON. Success returns <code className="text-ink">{`{ "data": ... }`}</code>;
              failure returns <code className="text-ink">{`{ "error": "..." }`}</code>{" "}
              with a 4xx or 5xx status. Creating an NCR may also return{" "}
              <code className="text-ink">warnings</code> — the record saved, but
              something after it did not.
            </p>
          </div>
        </CardBody>
      </Card>

      {GROUPS.map((group) => {
        const endpoints = apiEndpoints.filter((e) => e.group === group);
        if (endpoints.length === 0) return null;

        return (
          <section key={group} className="mb-6">
            <h2 className="mb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
              {group}
            </h2>
            <div className="space-y-3">
              {endpoints.map((endpoint) => (
                <EndpointCard
                  key={`${endpoint.method} ${endpoint.path}`}
                  endpoint={endpoint}
                  baseUrl={baseUrl}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

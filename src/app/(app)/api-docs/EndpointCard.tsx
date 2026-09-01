"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type { ApiEndpoint } from "@/config/apiEndpoints";

/** One endpoint: signature, parameters, a copyable curl and a live try. */
export function EndpointCard({
  endpoint,
  baseUrl,
}: {
  endpoint: ApiEndpoint;
  baseUrl: string;
}) {
  const [response, setResponse] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const curl =
    endpoint.method === "POST"
      ? [
          `curl -X POST ${baseUrl}/api/ncr \\`,
          `  -H "X-API-Key: $API_KEY" \\`,
          `  -F "categoryId=FLTY" \\`,
          `  -F "reportedBy=DW" \\`,
          `  -F "description=Describe the non-conformance here." \\`,
          `  -F "attachments=@photo.jpg"`,
        ].join("\n")
      : `curl -H "X-API-Key: $API_KEY" ${baseUrl}${endpoint.sample}`;

  async function tryIt() {
    setRunning(true);
    setResponse(null);
    try {
      const res = await fetch(endpoint.sample);
      const text = await res.text();
      try {
        setResponse(
          `${res.status} ${res.statusText}\n\n${JSON.stringify(JSON.parse(text), null, 2).slice(0, 4000)}`,
        );
      } catch {
        setResponse(`${res.status} ${res.statusText}\n\n${text.slice(0, 2000)}`);
      }
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={endpoint.method === "POST" ? "brand" : "graphite"}>
            {endpoint.method}
          </Badge>
          <code className="text-[13px] font-bold break-all text-ink">
            {endpoint.path}
          </code>
          {!endpoint.auth ? <Badge tone="ok">No auth</Badge> : null}
        </div>

        <div>
          <p className="text-sm font-bold text-ink">{endpoint.summary}</p>
          <p className="mt-0.5 text-[13px] text-ink-body">{endpoint.description}</p>
          {endpoint.note ? (
            <p className="mt-1.5 rounded-sm border border-warn/20 bg-warn-soft px-3 py-1.5 text-[12px] text-warn">
              {endpoint.note}
            </p>
          ) : null}
        </div>

        {endpoint.params?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-1.5 pr-4 text-left text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                    Parameter
                  </th>
                  <th className="py-1.5 pr-4 text-left text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                    Description
                  </th>
                  <th className="py-1.5 text-left text-[11px] font-bold tracking-wide text-ink-muted uppercase">
                    Example
                  </th>
                </tr>
              </thead>
              <tbody>
                {endpoint.params.map((param) => (
                  <tr key={param.name} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-4 align-top whitespace-nowrap">
                      <code className="font-semibold text-ink">{param.name}</code>
                      {param.required ? (
                        <span className="ml-1 text-brand-red">*</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-4 align-top text-ink-body">
                      {param.description}
                    </td>
                    <td className="py-1.5 align-top text-ink-muted">
                      {param.example ? <code>{param.example}</code> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? "Copied" : "Copy curl"}
            </Button>
            {endpoint.method === "GET" ? (
              <Button size="sm" onClick={tryIt} disabled={running}>
                {running ? "Running..." : "Try it"}
              </Button>
            ) : null}
          </div>
          <pre className="mt-2 overflow-x-auto rounded-sm bg-canvas p-3 text-[12px] text-ink">
            {curl}
          </pre>
        </div>

        {response ? (
          <pre className="max-h-72 overflow-auto rounded-sm border border-line bg-canvas p-3 text-[12px] text-ink">
            {response}
          </pre>
        ) : null}
      </CardBody>
    </Card>
  );
}

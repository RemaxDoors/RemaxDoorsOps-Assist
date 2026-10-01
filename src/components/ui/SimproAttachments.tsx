"use client";

import { useEffect, useState } from "react";
import { getJson, messageFor } from "@/lib/http";

type SimproAttachment = { id: string; filename: string };

const isImage = (filename: string) =>
  /\.(png|jpe?g|gif|webp|heic)$/i.test(filename);

/**
 * The photos as Simpro holds them, on the NCR record.
 *
 * Fetched after the page loads, not with it: Simpro is a third party over the
 * internet, and an NCR must still open when it is slow or down. A failure here
 * is reported in place and leaves the rest of the record alone.
 */
export function SimproAttachments({
  jobId,
  ncrId,
}: {
  jobId: string;
  ncrId: string;
}) {
  const [files, setFiles] = useState<SimproAttachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getJson<{ data: SimproAttachment[] }>(
      `/api/simpro/job/${encodeURIComponent(jobId)}/attachments?ncr=${encodeURIComponent(ncrId)}`,
    )
      .then((body) => {
        if (!cancelled) setFiles(body.data ?? []);
      })
      .catch((caught) => {
        if (!cancelled) setError(messageFor(caught, "Could not reach Simpro."));
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, ncrId]);

  if (error) {
    return (
      <p className="px-5 py-3 text-[12px] text-ink-muted">
        Simpro copy unavailable — {error}
      </p>
    );
  }

  if (files === null) {
    return (
      <p className="px-5 py-3 text-[12px] text-ink-muted">
        Checking Simpro for photos...
      </p>
    );
  }

  if (files.length === 0) {
    return (
      <p className="px-5 py-3 text-[12px] text-ink-muted">
        Nothing filed under &ldquo;NCR {ncrId}&rdquo; on the Simpro job.
      </p>
    );
  }

  return (
    <div className="px-5 py-3">
      <p className="mb-2 text-[12px] font-bold tracking-wide text-ink-muted uppercase">
        In Simpro ({files.length})
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {files.map((file) => {
          const href = `/api/simpro/job/${encodeURIComponent(jobId)}/attachments/${encodeURIComponent(file.id)}`;
          return (
            <li key={file.id}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-sm border border-line p-1 hover:border-graphite"
                title={file.filename}
              >
                {isImage(file.filename) ? (
                  // Served through the app, so the viewer needs no Simpro login
                  // and the API token stays on the server.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={href}
                    alt={file.filename}
                    loading="lazy"
                    className="h-24 w-full rounded-sm object-cover"
                  />
                ) : (
                  <span className="flex h-24 items-center justify-center text-[12px] text-ink-muted">
                    Open file
                  </span>
                )}
                <span className="mt-1 block truncate text-[11px] text-ink-body">
                  {file.filename}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Photo and file picker for the NCR wizard.
 *
 * Two inputs rather than one: the camera input carries `capture="environment"`,
 * which makes a phone open the rear camera directly, while the gallery input
 * is a normal multi-select file picker. On desktop both fall back to the OS
 * file dialog, so nothing is unreachable.
 */
export type PickedFile = { id: string; file: File; previewUrl: string | null };

export function AttachmentPicker({
  files,
  onChange,
}: {
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are per-file and must be released when the list changes.
  useEffect(() => {
    return () => {
      for (const item of files) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);

    const additions: PickedFile[] = [];
    for (const file of Array.from(list)) {
      if (file.size > 15 * 1024 * 1024) {
        setError(`${file.name} is larger than 15MB and was skipped.`);
        continue;
      }
      additions.push({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      });
    }

    const seen = new Set(files.map((f) => f.id));
    onChange([...files, ...additions.filter((f) => !seen.has(f.id))]);
  }

  function remove(id: string) {
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => cameraRef.current?.click()}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
          Take photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => galleryRef.current?.click()}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M4 5h16v14H4z" />
            <path d="m4 15 4.5-4.5L13 15l3-3 4 4" />
          </svg>
          Photos or files
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}

      {files.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-body">
          No attachments yet. Photos of the defect help whoever picks this up.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((item) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-sm border border-line"
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="grid h-24 w-full place-items-center bg-canvas text-[11px] font-bold text-ink-muted uppercase">
                  {item.file.name.split(".").pop() ?? "file"}
                </div>
              )}
              <p className="truncate px-2 py-1.5 text-[11px] text-ink-body">
                {item.file.name}
              </p>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-[13px] leading-none text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

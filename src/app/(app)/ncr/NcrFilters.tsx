"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NCR_STATUSES, type Lookup } from "@/types/ncr";

/** Filters live in the URL, so any view is shareable and bookmarkable. */
export function NcrFilters({ categories }: { categories: Lookup[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/ncr?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="h-9 w-full sm:w-60"
        placeholder="Search NCR, job or part..."
        defaultValue={params.get("search") ?? ""}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply("search", event.currentTarget.value.trim());
        }}
      />
      <Select
        className="h-9 w-[calc(50%-0.25rem)] sm:w-40"
        value={params.get("status") ?? ""}
        onChange={(event) => apply("status", event.target.value)}
        options={[
          { value: "", label: "All statuses" },
          ...NCR_STATUSES.map((s) => ({ value: s, label: s })),
        ]}
      />
      <Select
        className="h-9 w-[calc(50%-0.25rem)] sm:w-52"
        value={params.get("category") ?? ""}
        onChange={(event) => apply("category", event.target.value)}
        options={[
          { value: "", label: "All categories" },
          ...categories.map((c) => ({
            value: c.id,
            label: c.description || c.id,
          })),
        ]}
      />
      {params.size > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => router.push("/ncr")}>
          Clear
        </Button>
      ) : null}
      {pending ? (
        <span className="text-[12px] text-ink-muted">Updating...</span>
      ) : null}
    </div>
  );
}

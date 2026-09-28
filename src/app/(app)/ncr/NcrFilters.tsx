"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  GROUPINGS,
  GROUPING_LABELS,
  NCR_STATUSES,
  type Lookup,
} from "@/types/ncr";
import type { Employee } from "@/lib/repositories/employee.repo";

const CONTROL = "h-9 w-[calc(50%-0.25rem)] sm:w-44";

/** Filters live in the URL, so any view is shareable and bookmarkable. */
export function NcrFilters({
  categories,
  codes,
  causes,
  employees,
}: {
  categories: Lookup[];
  codes: Lookup[];
  causes: Lookup[];
  employees: Employee[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/ncr?${next.toString()}`));
  }

  const lookupOptions = (items: Lookup[], all: string) => [
    { value: "", label: all },
    ...items.map((item) => ({ value: item.id, label: item.description || item.id })),
  ];

  const peopleOptions = (all: string) => [
    { value: "", label: all },
    ...employees.map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <div className="space-y-2">
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
          className={CONTROL}
          value={params.get("status") ?? ""}
          onChange={(event) => apply("status", event.target.value)}
          options={[
            { value: "", label: "All statuses" },
            ...NCR_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          className={CONTROL}
          value={params.get("category") ?? ""}
          onChange={(event) => apply("category", event.target.value)}
          options={lookupOptions(categories, "All categories")}
        />
        <Select
          className={CONTROL}
          value={params.get("code") ?? ""}
          onChange={(event) => apply("code", event.target.value)}
          options={lookupOptions(codes, "All codes")}
        />
        <Select
          className={CONTROL}
          value={params.get("cause") ?? ""}
          onChange={(event) => apply("cause", event.target.value)}
          options={lookupOptions(causes, "All causes")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className={CONTROL}
          value={params.get("reporter") ?? ""}
          onChange={(event) => apply("reporter", event.target.value)}
          options={peopleOptions("Anyone reporting")}
        />
        <Select
          className={CONTROL}
          value={params.get("assignee") ?? ""}
          onChange={(event) => apply("assignee", event.target.value)}
          options={peopleOptions("Anyone assigned")}
        />
        {/*
          Raised between. Left as two plain dates rather than a preset list:
          "this month" already lives on the dashboard, and the reason someone
          filters here is usually an exact window they were given.
        */}
        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          From
          <Input
            type="date"
            className="h-9 w-36"
            value={params.get("from") ?? ""}
            onChange={(event) => apply("from", event.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          To
          <Input
            type="date"
            className="h-9 w-36"
            value={params.get("to") ?? ""}
            onChange={(event) => apply("to", event.target.value)}
          />
        </label>
        <Select
          className={CONTROL}
          value={params.get("groupBy") ?? "none"}
          onChange={(event) => apply("groupBy", event.target.value)}
          options={GROUPINGS.map((g) => ({
            value: g,
            label: g === "none" ? GROUPING_LABELS.none : `Group by ${GROUPING_LABELS[g].toLowerCase()}`,
          }))}
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
    </div>
  );
}

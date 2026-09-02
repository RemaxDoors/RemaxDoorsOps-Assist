"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  DIMENSIONS,
  DIMENSION_LABELS,
  PERIODS,
  PERIOD_OPTIONS,
  type Dimension,
} from "@/types/ncr";

/**
 * Period and breakdown controls, in one row above the charts.
 *
 * State lives in the URL so a view can be bookmarked or pasted to someone —
 * the same approach as the NCR list filters.
 */

export function DashboardFilters({
  period,
  dimension,
}: {
  period: string;
  dimension: Dimension;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    startTransition(() => router.push(`/dashboard?${next.toString()}`));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <Group
        label="Period"
        options={PERIODS.map((p) => ({ value: p, label: PERIOD_OPTIONS[p] }))}
        current={period}
        onSelect={(value) => set("period", value)}
      />
      <Group
        label="Break down by"
        options={DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABELS[d] }))}
        current={dimension}
        onSelect={(value) => set("dimension", value)}
      />
      {pending ? (
        <span className="text-[12px] text-ink-muted">Updating...</span>
      ) : null}
    </div>
  );
}

function Group({
  label,
  options,
  current,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  current: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex overflow-hidden rounded-sm border border-line"
      >
        {options.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={cn(
                "border-r border-line px-3 py-1.5 text-[13px] font-semibold last:border-r-0 transition-colors",
                active
                  ? "bg-ink text-white"
                  : "bg-surface text-ink-body hover:bg-canvas",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

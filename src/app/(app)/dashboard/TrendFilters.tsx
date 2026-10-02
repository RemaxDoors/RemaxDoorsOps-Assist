"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  TREND_DIMENSIONS,
  TREND_DIMENSION_LABELS,
  TREND_RANGES,
  TREND_RANGE_LABELS,
  type TrendDimension,
  type TrendRange,
} from "@/types/ncr";

/**
 * How far back, and what the bars are split by — one row above the charts.
 *
 * State lives in the URL, so a view can be bookmarked or pasted to someone,
 * the same as the NCR list filters. The date boxes only appear for "Between
 * dates": two empty inputs beside a chosen period would suggest they still
 * apply.
 */

export function TrendFilters({
  range,
  dimension,
  from,
  to,
}: {
  range: TrendRange;
  dimension: TrendDimension;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`/dashboard?${next.toString()}`));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <Group
        label="Period"
        options={TREND_RANGES.map((value) => ({
          value,
          label: TREND_RANGE_LABELS[value],
        }))}
        current={range}
        onSelect={(value) => go({ range: value })}
      />

      {range === "custom" ? (
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
            From
          </label>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => go({ from: event.target.value })}
            className="rounded-sm border border-line bg-surface px-2 py-1 text-[13px] text-ink"
          />
          <label className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">
            To
          </label>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => go({ to: event.target.value })}
            className="rounded-sm border border-line bg-surface px-2 py-1 text-[13px] text-ink"
          />
        </div>
      ) : null}

      <Group
        label="Break down by"
        options={TREND_DIMENSIONS.map((value) => ({
          value,
          label: TREND_DIMENSION_LABELS[value],
        }))}
        current={dimension}
        onSelect={(value) => go({ dimension: value })}
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

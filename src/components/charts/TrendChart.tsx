"use client";

import { useState } from "react";
import { colourFor } from "@/components/charts/palette";
import { formatMoney } from "@/lib/format";
import type { TrendBucket, TrendSeries } from "@/types/ncr";

/**
 * Change over time as columns, each split by one classification.
 *
 * Stacked rather than grouped because the question is "how many NCRs, and what
 * kind" — the column height answers the first, the segments the second. One
 * y-scale only: cost is a different measure and gets its own chart.
 *
 * A legend is always present and the hovered column prints its exact numbers,
 * so nothing here is carried by colour alone.
 */

/**
 * Which measure the columns carry, as a string rather than a formatter.
 *
 * A function cannot be handed from a server component to a client one, so the
 * page names the measure and the formatting happens here.
 */
export type Measure = "count" | "money";

export function TrendChart({
  buckets,
  series,
  valueLabel = "NCRs",
  measure = "count",
}: {
  buckets: TrendBucket[];
  series: TrendSeries[];
  valueLabel?: string;
  measure?: Measure;
}) {
  const [active, setActive] = useState<string | null>(null);
  const format = (value: number) =>
    measure === "money" ? formatMoney(value) : String(value);

  const totals = buckets.map((bucket) =>
    series.reduce((sum, entry) => sum + (bucket.counts[entry.id] ?? 0), 0),
  );
  const peak = Math.max(...totals, 1);
  const grand = totals.reduce((sum, value) => sum + value, 0);

  if (buckets.length === 0 || grand === 0) {
    return (
      <p className="px-5 py-10 text-center text-[13px] text-ink-body">
        No NCRs in this window.
      </p>
    );
  }

  const colour = (id: string) =>
    colourFor(
      series.findIndex((entry) => entry.id === id),
      id,
    );

  /**
   * Labels thin out rather than rotate or overlap: with thirty daily columns
   * only every third date is printed, and the hover readout carries the rest.
   */
  const every = buckets.length > 24 ? 4 : buckets.length > 14 ? 2 : 1;
  const shown = active ? buckets.find((bucket) => bucket.start === active) : null;

  return (
    <div>
      {/* Readout sits above the plot so the columns never move under the cursor. */}
      <div className="mb-2 flex min-h-[22px] flex-wrap items-baseline gap-x-3 text-[12px]">
        {shown ? (
          <>
            <span className="font-semibold text-ink">{shown.label}</span>
            {series
              .filter((entry) => (shown.counts[entry.id] ?? 0) > 0)
              .map((entry) => (
                <span key={entry.id} className="flex items-center gap-1.5 text-ink-body">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-[2px]"
                    style={{ background: colour(entry.id) }}
                  />
                  {entry.label}{" "}
                  <span className="font-semibold text-ink tabular-nums">
                    {format(shown.counts[entry.id] ?? 0)}
                  </span>
                </span>
              ))}
          </>
        ) : (
          <span className="text-ink-muted">
            {format(grand)} {valueLabel} · hover a column for the detail
          </span>
        )}
      </div>

      <div className="flex h-44 items-end gap-[3px] border-b border-line">
        {buckets.map((bucket, i) => {
          const total = totals[i];
          const dim = active !== null && active !== bucket.start;
          return (
            <div
              key={bucket.start}
              onMouseEnter={() => setActive(bucket.start)}
              onMouseLeave={() => setActive(null)}
              className="flex h-full flex-1 cursor-default flex-col justify-end"
              title={`${bucket.label}: ${format(total)} ${valueLabel}`}
            >
              {/* Top segment first, so the stack reads the same as the legend. */}
              <div
                className="flex w-full flex-col justify-end transition-opacity"
                style={{
                  height: `${total === 0 ? 0 : Math.max((total / peak) * 100, 2)}%`,
                  opacity: dim ? 0.45 : 1,
                }}
              >
                {[...series].reverse().map((entry) => {
                  const value = bucket.counts[entry.id] ?? 0;
                  if (value === 0) return null;
                  return (
                    <div
                      key={entry.id}
                      // 2px of surface between fills, and only the top segment
                      // is rounded — the stack is anchored to the baseline.
                      className="w-full border-b-2 border-surface last:border-b-0 first:rounded-t-[4px]"
                      style={{
                        height: `${(value / total) * 100}%`,
                        background: colour(entry.id),
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-[3px]">
        {buckets.map((bucket, i) => (
          <span
            key={bucket.start}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-ink-muted"
          >
            {i % every === 0 ? bucket.label : ""}
          </span>
        ))}
      </div>

      {series.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((entry) => (
            <li key={entry.id} className="flex items-center gap-1.5 text-[12px]">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: colour(entry.id) }}
              />
              <span className="text-ink-body">{entry.label}</span>
              <span className="font-semibold text-ink tabular-nums">
                {entry.total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

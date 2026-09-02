"use client";

import { useState } from "react";

/**
 * Horizontal bars for magnitude comparison — one measure, one hue.
 *
 * Horizontal because the labels are people's names: they read straight rather
 * than rotated, and the list can grow without crowding.
 */

export type Bar = { id: string; label: string; count: number };

export function BarChart({
  bars,
  valueLabel = "NCRs raised",
}: {
  bars: Bar[];
  valueLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  if (bars.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-[13px] text-ink-body">
        Nothing to chart yet.
      </p>
    );
  }

  const max = Math.max(...bars.map((b) => b.count), 1);

  return (
    <ul className="space-y-2.5">
      {bars.map((bar) => {
        const share = bar.count / max;
        const dim = active !== null && active !== bar.id;

        return (
          <li
            key={bar.id}
            onMouseEnter={() => setActive(bar.id)}
            onMouseLeave={() => setActive(null)}
            title={`${bar.label} — ${bar.count} ${valueLabel}`}
            className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3"
          >
            <span className="truncate text-[13px] text-ink-body">{bar.label}</span>

            {/* Track is a recessive surface; only the fill carries the value. */}
            <span className="h-3.5 w-full rounded-[3px] bg-canvas">
              <span
                className="block h-full rounded-[3px] bg-brand-red transition-opacity"
                style={{
                  width: `${Math.max(share * 100, 1.5)}%`,
                  opacity: dim ? 0.4 : 1,
                }}
              />
            </span>

            <span className="text-right text-[13px] font-semibold text-ink tabular-nums">
              {bar.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

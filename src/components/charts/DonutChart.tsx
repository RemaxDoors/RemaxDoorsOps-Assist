"use client";

import { useState } from "react";

/**
 * Category breakdown as a donut with a value legend.
 *
 * A donut cannot separate close values by eye — two of these categories differ
 * by three records — so the legend carries the exact count and share beside
 * every swatch. That is also what satisfies the palette's contrast warning:
 * identity never rests on colour alone.
 */

export type Slice = { id: string; label: string; count: number };

/** Validated categorical order — assigned by position, never cycled. */
const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
] as const;

const SIZE = 190;
const RADIUS = 82;
const THICKNESS = 26;
/** Degrees of surface between segments, so adjacent fills never touch. */
const GAP = 1.6;

/**
 * Fixed precision, not raw floats: server and client can format the same
 * number to a different number of digits, which React reports as a hydration
 * mismatch. Three decimals is far finer than a screen pixel here.
 */
const round = (n: number) => n.toFixed(3);

function arc(startAngle: number, endAngle: number) {
  const r = RADIUS;
  const inner = RADIUS - THICKNESS;
  const c = SIZE / 2;
  const point = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [
      round(c + radius * Math.cos(rad)),
      round(c + radius * Math.sin(rad)),
    ];
  };

  const [x1, y1] = point(startAngle, r);
  const [x2, y2] = point(endAngle, r);
  const [x3, y3] = point(endAngle, inner);
  const [x4, y4] = point(startAngle, inner);
  const large = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function DonutChart({
  slices,
  total,
  centreLabel = "records",
}: {
  slices: Slice[];
  total: number;
  centreLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  if (total === 0) {
    return (
      <p className="px-5 py-10 text-center text-[13px] text-ink-body">
        No records to chart yet.
      </p>
    );
  }

  let cursor = 0;
  const segments = slices.map((slice, index) => {
    const share = slice.count / total;
    const sweep = share * 360;
    const start = cursor + GAP / 2;
    const end = cursor + sweep - GAP / 2;
    cursor += sweep;
    return {
      ...slice,
      share,
      colour: SERIES[index % SERIES.length],
      // A sliver narrower than the gap would render inside out.
      path: end > start ? arc(start, end) : null,
    };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[190px] w-[190px] shrink-0"
        role="img"
        aria-label={`Non-conformances by category, ${total} records`}
      >
        {segments.map((segment) =>
          segment.path ? (
            <path
              key={segment.id}
              d={segment.path}
              fill={segment.colour}
              opacity={active && active !== segment.id ? 0.35 : 1}
              onMouseEnter={() => setActive(segment.id)}
              onMouseLeave={() => setActive(null)}
              className="cursor-default transition-opacity"
            />
          ) : null,
        )}

        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="fill-ink text-[26px] font-extrabold"
        >
          {active
            ? (segments.find((s) => s.id === active)?.count ?? total)
            : total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          className="fill-ink-muted text-[10px] font-bold tracking-wide uppercase"
        >
          {active
            ? `${Math.round((segments.find((s) => s.id === active)?.share ?? 0) * 100)}%`
            : centreLabel}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.id}
            onMouseEnter={() => setActive(segment.id)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-2.5 text-[13px]"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: segment.colour }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-body">
              {segment.label}
            </span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">
              {segment.count}
            </span>
            <span className="w-10 shrink-0 text-right text-ink-muted tabular-nums">
              {Math.round(segment.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import {
  TREND_OTHER_ID,
  type TrendBucket,
  type TrendBucketSize,
  type TrendRange,
  type TrendSeries,
} from "@/types/ncr";

/**
 * The shape of a trend: which bars exist, how wide they are, and which series
 * survive the palette. No database and no SQL — this is calendar arithmetic and
 * it is the part that is easy to get wrong, so it lives where it can be tested
 * on its own.
 */

export type Window = { from: Date; to: Date };

export const startOfDay = (when: Date) =>
  new Date(when.getFullYear(), when.getMonth(), when.getDate());

/** Monday, so a week bar always starts on the same weekday. */
export function startOfWeek(when: Date) {
  const day = startOfDay(when);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

export const startOfMonth = (when: Date) =>
  new Date(when.getFullYear(), when.getMonth(), 1);

export function bucketStart(when: Date, size: TrendBucketSize) {
  if (size === "day") return startOfDay(when);
  if (size === "week") return startOfWeek(when);
  return startOfMonth(when);
}

export function nextBucket(start: Date, size: TrendBucketSize) {
  if (size === "day")
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (size === "week")
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

export const isoDay = (when: Date) =>
  `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(
    when.getDate(),
  ).padStart(2, "0")}`;

const parseDay = (value: string | null) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * The window a range covers, and the bar width that suits it.
 *
 * A range means "how far back from today", so the window always ends tonight.
 * Widths keep the chart between roughly 7 and 30 bars: fewer hides the shape,
 * more turns a stacked bar into a smear.
 */
export function trendWindow(
  range: TrendRange,
  from: string | null = null,
  to: string | null = null,
  now = new Date(),
): { range: Window; bucket: TrendBucketSize } {
  const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const back = (days: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);

  if (range === "custom") {
    const start = parseDay(from);
    const end = parseDay(to);
    // An end date is inclusive on screen, so the window runs to the next midnight.
    const stop = end
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
      : tonight;
    const begin = start ?? back(30);
    // Reversed dates would draw an empty chart with nothing to explain it.
    const [first, last] = begin <= stop ? [begin, stop] : [stop, begin];
    const span = (last.getTime() - first.getTime()) / 86_400_000;
    const bucket: TrendBucketSize = span <= 31 ? "day" : span <= 190 ? "week" : "month";
    return { range: { from: bucketStart(first, bucket), to: last }, bucket };
  }

  switch (range) {
    case "week":
      return { range: { from: back(7), to: tonight }, bucket: "day" };
    case "month":
      return { range: { from: back(30), to: tonight }, bucket: "day" };
    case "6months":
      return { range: { from: startOfWeek(back(182)), to: tonight }, bucket: "week" };
    case "year":
      return { range: { from: startOfMonth(back(365)), to: tonight }, bucket: "month" };
  }
}

export function bucketLabel(start: Date, size: TrendBucketSize) {
  if (size === "month")
    return start.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
  return start.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/**
 * Every bar the window covers, including the empty ones.
 *
 * A quiet week is a finding. Skipping it would draw a straight line through the
 * gap and make the trend look steadier than it was.
 */
export function emptyBuckets(window: Window, size: TrendBucketSize): TrendBucket[] {
  let cursor = bucketStart(window.from, size);
  const buckets: TrendBucket[] = [];
  // Bounded rather than trusting the dates: a bad custom range must not spin here.
  while (cursor < window.to && buckets.length < 400) {
    buckets.push({
      start: isoDay(cursor),
      label: bucketLabel(cursor, size),
      counts: {},
      cost: 0,
    });
    cursor = nextBucket(cursor, size);
  }
  return buckets;
}

/** Series past the validated six-hue palette fold into one "Other". */
export const TREND_SERIES_LIMIT = 6;

/**
 * Busiest series first, with the tail collapsed into "Other" in both the legend
 * and the bars — so a seventh classification never needs a seventh colour.
 */
export function foldSeries(
  tallies: Array<{ id: string; label: string; total: number }>,
  buckets: TrendBucket[],
): TrendSeries[] {
  const ranked = [...tallies].sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label),
  );
  const series: TrendSeries[] = ranked.slice(0, TREND_SERIES_LIMIT);
  const tail = ranked.slice(TREND_SERIES_LIMIT);
  if (tail.length === 0) return series;

  const tailIds = new Set(tail.map((entry) => entry.id));
  series.push({
    id: TREND_OTHER_ID,
    label: `Other (${tail.length})`,
    total: tail.reduce((sum, entry) => sum + entry.total, 0),
  });

  for (const bucket of buckets) {
    let rest = 0;
    for (const id of Object.keys(bucket.counts)) {
      if (!tailIds.has(id)) continue;
      rest += bucket.counts[id];
      delete bucket.counts[id];
    }
    if (rest > 0) bucket.counts[TREND_OTHER_ID] = rest;
  }

  return series;
}

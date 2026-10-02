import { TREND_OTHER_ID } from "@/types/ncr";

/**
 * The validated categorical palette, in fixed order.
 *
 * Six hues that passed the lightness-band, chroma-floor and colour-vision
 * separation checks against this app's surface. Assigned by position and never
 * cycled: a seventh series folds into OTHER rather than inventing a hue that
 * would be indistinguishable from one already on screen.
 *
 * Contrast against the surface is a WARN rather than a pass, which is why every
 * chart using these also carries a legend and the exact numbers — identity is
 * never left to colour alone.
 */
export const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
] as const;

/** Anything past the palette folds into one grey rest-of-field. */
export const OTHER = "#9a9a95";

export const colourFor = (index: number, id?: string) =>
  id === TREND_OTHER_ID ? OTHER : (SERIES[index] ?? OTHER);

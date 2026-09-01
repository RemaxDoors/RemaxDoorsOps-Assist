/** Brand values for use in TS (charts, PDFs, emails). CSS side: globals.css. */
export const brand = {
  red: "#EA0029",
  redDark: "#C30022",
  black: "#000000",
  bodyGrey: "#666666",
  lightGrey: "#F4F4F4",
  white: "#FFFFFF",
} as const;

/** Badge tone per NCR status. */
export const statusColors = {
  Open: "brand",
  Closed: "ok",
} as const;

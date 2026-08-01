/**
 * Chart colors from the validated data-viz reference palette (light mode).
 * income/expense is a colorblind-safe pair (aqua + blue) — deliberately NOT
 * the classic red/green, which fails for red-green color vision deficiency.
 */
export const CHART = {
  income: "#1baf7a", // categorical slot 2 (aqua)
  expense: "#2a78d6", // categorical slot 1 (blue)
  single: "#2a78d6", // single-series bars
  secondary: "#52514e", // secondary ink (labels)
  muted: "#898781", // axis ticks
  grid: "#e1e0d9", // hairline gridlines
  positive: "#006300", // success text (net surplus)
  negative: "#d03b3b", // critical (net deficit)
} as const;

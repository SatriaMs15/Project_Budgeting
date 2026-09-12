/**
 * Ledger palette for charts and money marks (light theme only).
 *
 * income/expense is a colorblind-safe pair (aqua + blue) — deliberately NOT
 * the classic red/green, which fails for red-green color vision deficiency.
 * Each has a "mark" value (dots, bars, rules) and, where needed, a deepened
 * "ink" value that carries enough contrast to be used as text.
 */
export const CHART = {
  income: "#1baf7a", // marks
  incomeInk: "#0d7a56", // same hue, deepened for text (5.3:1 on paper)
  expense: "#2a78d6", // marks: bars, dots, rules
  expenseInk: "#266dc3", // deepened for text (4.6:1 on paper, 5.2:1 on card)
  single: "#2a78d6", // single-series bars
  negative: "#a83e2a", // over budget, deficit, errors
  accent: "#b68235", // stroke-only gold
  accentInk: "#7d5411", // gold used as text
  secondary: "#605d5d", // secondary ink (labels)
  muted: "#7d7979", // axis ticks
  grid: "#d7d3d3", // hairline gridlines
} as const;

/** Text ink for a signed amount of the given kind. */
export function moneyInk(kind: "income" | "expense"): string {
  return kind === "income" ? CHART.incomeInk : CHART.expenseInk;
}

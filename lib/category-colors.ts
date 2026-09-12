/**
 * Category mark colors for the ledger design.
 *
 * Resolved by NAME rather than read from `categories.color`, because accounts
 * seeded before the redesign still carry the old bright hues in the database.
 * Keying off the name means the palette holds without a data migration; only
 * user-created categories fall through to the kind-based default.
 */

const EXPENSE_MARKS: Record<string, string> = {
  "food & drink": "#a1584a",
  shopping: "#82733a",
  bills: "#55716f",
  transport: "#667488",
  entertainment: "#6c5b7d",
  health: "#96586a",
  other: "#767272",
};

/** Income categories all reuse the income ink so money reads consistently. */
const INCOME_MARK = "#0d7a56";

/** Neutral fallback for categories the design didn't name. */
const FALLBACK = "#767272";

export function categoryColor(
  category: { name: string; kind: "income" | "expense" } | null | undefined,
): string {
  if (!category) return FALLBACK;
  if (category.kind === "income") return INCOME_MARK;
  return EXPENSE_MARKS[category.name.trim().toLowerCase()] ?? FALLBACK;
}

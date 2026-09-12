/**
 * Category mark colors for the ledger design.
 *
 * Resolved by NAME first rather than read from `categories.color`, because
 * accounts seeded before the redesign still carry the old bright hues in the
 * database. Keying off the name means the palette holds without a data
 * migration. Categories the design never named are the ones the user created
 * themselves, and those DO carry a stored mark we assigned at creation — see
 * `pickCategoryColor` — so their stored value is honoured, but only when it is
 * genuinely one of the ledger marks.
 */

import type { Kind } from "@/lib/supabase/types";

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

/** Neutral fallback for categories with no mark we recognise. */
const FALLBACK = "#767272";

/**
 * The marks a new expense category may be given, in assignment order.
 *
 * The first six are the designed category hues; the last four extend the same
 * muted, mid-dark family so that a user's own categories do not immediately
 * collide with a seeded one. That collision is the reason this list is longer
 * than the design's palette: the seven defaults consume six hues plus the
 * neutral, so a six-entry list handed the very first user-created category the
 * same terracotta as "Food & Drink", two rows apart on screen.
 *
 * The neutral grey is deliberately absent: it is the fallback tone, and handing
 * it out would make a real category look like an unrecognised one.
 *
 * Every entry clears WCAG AA (4.5:1) as text on the card, which is the only
 * surface a category tag renders on; the four added here clear it on the paper
 * ground as well, which three of the design's original six do not. All ten stay
 * clear of the income ink under simulated red-green colour vision deficiency
 * and sit at least as far apart as the design's own hues already do. Each of
 * those claims is enforced in tests/color-invariants.test.ts.
 *
 * The order interleaves colour families so consecutively created categories
 * look obviously different. Marks still repeat once all ten are in use, which
 * is acceptable because a tag always carries the category's name: colour is
 * reinforcement here, never the sole identifier.
 */
export const ASSIGNABLE_EXPENSE_MARKS = [
  "#a1584a", // terracotta
  "#55716f", // teal grey
  "#82733a", // olive gold
  "#667488", // slate blue
  "#96586a", // rose
  "#6c5b7d", // plum
  "#8a4545", // burgundy
  "#42618f", // steel blue
  "#55692f", // moss
  "#275a72", // deep teal
] as const;

/** Every hex value the ledger palette recognises as a category mark. */
const LEDGER_MARKS = new Set<string>([
  ...Object.values(EXPENSE_MARKS),
  ...ASSIGNABLE_EXPENSE_MARKS,
  INCOME_MARK,
]);

type CategoryLike = {
  name: string;
  kind: Kind;
  color?: string | null;
};

export function categoryColor(
  category: CategoryLike | null | undefined,
): string {
  if (!category) return FALLBACK;
  if (category.kind === "income") return INCOME_MARK;

  const named = EXPENSE_MARKS[category.name.trim().toLowerCase()];
  if (named) return named;

  // Unnamed by the design — a user-created category. Trust its stored mark only
  // if it is one of ours; a pre-redesign hue would break the palette.
  const stored = category.color?.trim().toLowerCase();
  if (stored && LEDGER_MARKS.has(stored)) return stored;

  return FALLBACK;
}

/**
 * Choose the mark for a new category, so the user never has to pick one.
 *
 * Income always takes the income ink. For expenses, the least-used mark wins,
 * ties broken by palette order — so marks stay spread out as categories are
 * added and removed, rather than drifting with a running counter that a delete
 * would desynchronise.
 */
export function pickCategoryColor(
  kind: Kind,
  existing: readonly CategoryLike[],
): string {
  if (kind === "income") return INCOME_MARK;

  const uses = new Map<string, number>(
    ASSIGNABLE_EXPENSE_MARKS.map((mark) => [mark, 0]),
  );
  for (const category of existing) {
    if (category.kind !== "expense") continue;
    const mark = categoryColor(category);
    const seen = uses.get(mark);
    if (seen !== undefined) uses.set(mark, seen + 1);
  }

  let best: string = ASSIGNABLE_EXPENSE_MARKS[0];
  let fewest = uses.get(best) ?? 0;
  for (const mark of ASSIGNABLE_EXPENSE_MARKS) {
    const count = uses.get(mark) ?? 0;
    if (count < fewest) {
      fewest = count;
      best = mark;
    }
  }
  return best;
}

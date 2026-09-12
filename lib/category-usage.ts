/**
 * What deleting a category actually costs.
 *
 * The database does two different things to the rows that point at a category
 * (supabase/migrations/0001_init.sql), and the difference is the whole reason
 * this warning exists:
 *   - transactions and recurring_rules are ON DELETE SET NULL — the rows stay,
 *     they just lose the label;
 *   - budgets are ON DELETE CASCADE — the limits are gone for good, and nothing
 *     in the UI would otherwise hint at it.
 *
 * The copy lives here rather than in the dialog so the counting and the
 * pluralisation can be tested without rendering anything.
 */

import { formatIDR } from "@/lib/format";

export type CategoryUsage = {
  /** Transactions filed under this category, all time. */
  transactions: number;
  /** Recurring rules pointing at it. */
  recurring: number;
  /** How many months carry a budget limit for it. */
  budgetMonths: number;
  /** This month's limit, if one is set — the figure the user recognises. */
  currentLimit: number | null;
};

export const NO_USAGE: CategoryUsage = {
  transactions: 0,
  recurring: 0,
  budgetMonths: 0,
  currentLimit: null,
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Split the consequences into what is destroyed and what merely comes unlinked,
 * because those two deserve different weight on screen.
 */
export function describeCategoryDeletion(usage: CategoryUsage): {
  destroyed: string[];
  preserved: string[];
} {
  const destroyed: string[] = [];
  const preserved: string[] = [];

  if (usage.budgetMonths > 0) {
    const limits = plural(usage.budgetMonths, "budget limit", "budget limits");
    const thisMonth =
      usage.currentLimit !== null
        ? ` — including ${formatIDR(usage.currentLimit)} set for this month`
        : "";
    destroyed.push(`${limits} will be deleted for good${thisMonth}.`);
  }

  if (usage.transactions > 0) {
    preserved.push(
      usage.transactions === 1
        ? "1 transaction keeps its amount and date, but becomes Uncategorized."
        : `${usage.transactions} transactions keep their amounts and dates, but become Uncategorized.`,
    );
  }

  if (usage.recurring > 0) {
    preserved.push(
      `${plural(usage.recurring, "recurring item keeps", "recurring items keep")} running, without a category.`,
    );
  }

  return { destroyed, preserved };
}

import { setBudget } from "@/app/actions/budgets";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";
import type { Category } from "@/lib/supabase/types";

/** Shared column track for the budget table's header and rows. */
export const BUDGET_COLS =
  "grid grid-cols-[130px_1fr_240px_230px] gap-4 min-w-[700px]";

export type BudgetStatus = "under" | "near" | "over" | "none";

/**
 * Status is carried by a word first and a color second, so the reading never
 * depends on hue alone. Under 80% / 80–99% / at-or-over 100%.
 */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "none";
  const pct = (spent / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= 80) return "near";
  return "under";
}

export function statusColor(status: BudgetStatus): string {
  if (status === "over") return CHART.negative;
  if (status === "near") return CHART.accent;
  if (status === "under") return CHART.incomeInk;
  return CHART.muted;
}

/**
 * Overall figures for the month.
 *
 * Only categories that actually carry a limit are counted, on BOTH sides.
 * Summing all spending against only-budgeted limits compares different things
 * and pushes the overall line into "over" as soon as any unbudgeted category
 * has spending — which read as over budget while every individual row still
 * said it was fine.
 */
const SEVERITY: Record<BudgetStatus, number> = {
  none: 0,
  under: 1,
  near: 2,
  over: 3,
};

export function summarizeBudgets(
  rows: { spent: number; limit: number }[],
): {
  budgeted: number;
  spent: number;
  /** Aggregate ratio across budgeted categories — drives the bar's length. */
  status: BudgetStatus;
  /** Worst individual category — drives the colour, per the design. */
  worst: BudgetStatus;
  overCount: number;
  hasLimits: boolean;
} {
  const withLimit = rows.filter((r) => r.limit > 0);
  const budgeted = withLimit.reduce((s, r) => s + r.limit, 0);
  const spent = withLimit.reduce((s, r) => s + r.spent, 0);

  const statuses = withLimit.map((r) => budgetStatus(r.spent, r.limit));
  const overCount = statuses.filter((s) => s === "over").length;
  const worst = statuses.reduce<BudgetStatus>(
    (acc, s) => (SEVERITY[s] > SEVERITY[acc] ? s : acc),
    "none",
  );

  return {
    budgeted,
    spent,
    status: budgetStatus(spent, budgeted),
    // Colour by the worst single category, so one blown budget is visible
    // before you read any individual row — the aggregate can look healthy
    // while a category is well over.
    worst,
    overCount,
    hasLimits: withLimit.length > 0,
  };
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  under: "Under",
  near: "Near",
  over: "Over",
  none: "No limit",
};

export function BudgetRow({
  category,
  spent,
  limit,
}: {
  category: Category;
  spent: number;
  limit: number;
}) {
  const status = budgetStatus(spent, limit);
  const color = statusColor(status);
  const hasLimit = limit > 0;
  const width = hasLimit ? Math.min(100, (spent / limit) * 100) : 0;

  return (
    <div
      className={`${BUDGET_COLS} items-center border-b border-divider py-3.5`}
    >
      <span className="text-[13.5px] font-semibold">{category.name}</span>

      <div className="h-1 overflow-hidden rounded-sm bg-divider">
        <div
          className="h-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>

      <span className="text-right text-[13px] tabular-nums">
        <span className="font-semibold" style={{ color }}>
          {STATUS_LABEL[status]}
        </span>{" "}
        · {formatIDR(spent)}
        {hasLimit ? ` of ${formatIDR(limit)}` : ""}
      </span>

      <form
        action={setBudget}
        className="flex items-center justify-end gap-2"
      >
        <input type="hidden" name="category_id" value={category.id} />
        <div className="w-[132px]">
          <MoneyInput name="limit_amount" defaultValue={limit} className="h-[30px]" />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Save
        </Button>
      </form>
    </div>
  );
}

import { setBudget } from "@/app/actions/budgets";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";
import type { Category } from "@/lib/supabase/types";

/** Shared column track for the budget table's header and rows. */
export const BUDGET_COLS =
  "grid grid-cols-[130px_1fr_220px_210px] gap-4 min-w-[660px]";

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
        <div className="w-[110px]">
          <MoneyInput name="limit_amount" defaultValue={limit} className="h-[30px]" />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Save
        </Button>
      </form>
    </div>
  );
}

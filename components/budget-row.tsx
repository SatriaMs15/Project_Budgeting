import { setBudget } from "@/app/actions/budgets";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import type { Category } from "@/lib/supabase/types";

export function BudgetRow({
  category,
  spent,
  limit,
}: {
  category: Category;
  spent: number;
  limit: number;
}) {
  const hasLimit = limit > 0;
  const pct = hasLimit ? (spent / limit) * 100 : 0;
  const width = Math.min(100, pct);

  // green under 80%, amber approaching, red at/over 100%.
  const barColor =
    pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#22c55e";

  const remaining = limit - spent;

  return (
    <div className="grid gap-2 py-4">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-sm font-medium">{category.name}</span>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {formatIDR(spent)}
          {hasLimit ? ` / ${formatIDR(limit)}` : ""}
        </span>
      </div>

      {hasLimit && (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${width}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {remaining >= 0
              ? `${formatIDR(remaining)} left`
              : `${formatIDR(-remaining)} over budget`}
          </p>
        </>
      )}

      <form action={setBudget} className="flex items-end gap-2">
        <input type="hidden" name="category_id" value={category.id} />
        <div className="w-40">
          <MoneyInput name="limit_amount" defaultValue={limit} />
        </div>
        <Button type="submit" variant="outline" size="sm">
          {hasLimit ? "Update" : "Set limit"}
        </Button>
      </form>
    </div>
  );
}

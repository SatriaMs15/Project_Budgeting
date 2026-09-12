import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { monthStart, nextMonthStart, monthLabel } from "@/lib/date";
import {
  BudgetRow,
  BUDGET_COLS,
  statusColor,
  summarizeBudgets,
} from "@/components/budget-row";
import { formatIDR } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export default async function BudgetsPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();
  const ms = monthStart();
  const nms = nextMonthStart();

  const [categoriesRes, budgetsRes, txnsRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("kind", "expense")
      .order("name"),
    supabase.from("budgets").select("*").eq("month", ms),
    supabase
      .from("transactions")
      .select("category_id, amount")
      .eq("kind", "expense")
      .gte("occurred_on", ms)
      .lt("occurred_on", nms),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const budgets = unwrap(budgetsRes, "load budgets");
  const txns = unwrap(txnsRes, "load this month's spending");

  const limitByCat = new Map(budgets.map((b) => [b.category_id, b.limit_amount]));
  const spentByCat = new Map<string, number>();
  for (const t of txns) {
    if (!t.category_id) continue;
    spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount);
  }

  const summary = summarizeBudgets(
    categories.map((c) => ({
      spent: spentByCat.get(c.id) ?? 0,
      limit: limitByCat.get(c.id) ?? 0,
    })),
  );
  const overallColor = statusColor(summary.worst);
  const overallWidth =
    summary.budgeted > 0
      ? Math.min(100, (summary.spent / summary.budgeted) * 100)
      : 0;

  return (
    <div>
      <h1 className="mb-1 font-heading text-[32px] font-semibold">Budgets</h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Monthly spending limits for {monthLabel()}
      </p>

      <Card className="elev-sm">
        <CardContent>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <p className="kicker">Overall</p>
            <span
              className="text-[13px] tabular-nums"
              style={{ color: summary.hasLimits ? overallColor : undefined }}
            >
              {summary.hasLimits
                ? `${formatIDR(summary.spent)} of ${formatIDR(summary.budgeted)} budgeted`
                : "No limits set yet"}
            </span>
          </div>

          <p className="mb-3.5 text-[12.5px] text-muted-foreground">
            {!summary.hasLimits
              ? "Set a limit on any category to start tracking against it."
              : summary.overCount > 0
                ? `${summary.overCount} categor${summary.overCount === 1 ? "y" : "ies"} over budget`
                : "All categories within budget"}
          </p>

          <div className="mb-5 h-1 overflow-hidden rounded-sm bg-divider">
            <div
              className="h-full"
              style={{
                width: `${overallWidth}%`,
                backgroundColor: overallColor,
              }}
            />
          </div>

          <div className="overflow-x-auto">
            <div className={`${BUDGET_COLS} col-head border-b border-divider pb-2.5`}>
              <span>Category</span>
              <span>Progress</span>
              <span className="text-right">Status</span>
              <span className="text-right">Limit</span>
            </div>

            {categories.map((c) => (
              <BudgetRow
                key={c.id}
                category={c}
                spent={spentByCat.get(c.id) ?? 0}
                limit={limitByCat.get(c.id) ?? 0}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

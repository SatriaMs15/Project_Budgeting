import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { monthStart, nextMonthStart, monthLabel } from "@/lib/date";
import {
  BudgetRow,
  BUDGET_COLS,
  budgetStatus,
  statusColor,
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

  const totalBudget = budgets.reduce((s, b) => s + b.limit_amount, 0);
  const totalSpent = txns.reduce((s, t) => s + t.amount, 0);

  const overCount = categories.filter(
    (c) =>
      budgetStatus(spentByCat.get(c.id) ?? 0, limitByCat.get(c.id) ?? 0) ===
      "over",
  ).length;

  // The overall line takes the worst status among the categories, so a single
  // blown budget is visible before you read any individual row.
  const overallStatus = budgetStatus(totalSpent, totalBudget);
  const overallColor = statusColor(overallStatus);
  const overallWidth =
    totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

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
              style={{ color: overallColor }}
            >
              {formatIDR(totalSpent)}
              {totalBudget > 0
                ? ` of ${formatIDR(totalBudget)} budgeted`
                : " spent · no limits set"}
            </span>
          </div>

          <p className="mb-3.5 text-[12.5px] text-muted-foreground">
            {overCount > 0
              ? `${overCount} categor${overCount === 1 ? "y" : "ies"} over budget`
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

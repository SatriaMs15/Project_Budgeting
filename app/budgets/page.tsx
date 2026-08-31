import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { monthStart, nextMonthStart, monthLabel } from "@/lib/date";
import { BudgetRow } from "@/components/budget-row";
import { formatIDR } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BudgetsPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();
  const ms = monthStart();
  const nms = nextMonthStart();

  const [categoriesRes, budgetsRes, txnsRes] =
    await Promise.all([
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

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          Monthly spending limits for {monthLabel()}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
          <CardDescription>
            Spent {formatIDR(totalSpent)}
            {totalBudget > 0 ? ` of ${formatIDR(totalBudget)} budgeted` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y pt-0">
          {categories.map((c) => (
            <BudgetRow
              key={c.id}
              category={c}
              spent={spentByCat.get(c.id) ?? 0}
              limit={limitByCat.get(c.id) ?? 0}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

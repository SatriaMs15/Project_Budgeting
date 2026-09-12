import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { pickCategoryColor } from "@/lib/category-colors";
import { monthStart } from "@/lib/date";
import { AddCategoryForm } from "@/components/add-category-form";
import { CategoryList } from "@/components/category-list";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryUsage } from "@/lib/category-usage";

export default async function CategoriesPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();
  const thisMonth = monthStart();

  // The delete warning has to be specific, so the counts behind it are read
  // here rather than guessed in the dialog. Budgets are read across ALL months,
  // not just this one, because the cascade takes every month's limit with it.
  const [categoriesRes, txnsRes, rulesRes, budgetsRes] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("transactions").select("category_id"),
    supabase.from("recurring_rules").select("category_id"),
    supabase.from("budgets").select("category_id, month, limit_amount"),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const txns = unwrap(txnsRes, "load transactions");
  const rules = unwrap(rulesRes, "load recurring items");
  const budgets = unwrap(budgetsRes, "load budgets");

  const usageById = new Map<string, CategoryUsage>(
    categories.map((c) => [
      c.id,
      { transactions: 0, recurring: 0, budgetMonths: 0, currentLimit: null },
    ]),
  );

  for (const t of txns) {
    const usage = t.category_id ? usageById.get(t.category_id) : undefined;
    if (usage) usage.transactions += 1;
  }
  for (const r of rules) {
    const usage = r.category_id ? usageById.get(r.category_id) : undefined;
    if (usage) usage.recurring += 1;
  }
  for (const b of budgets) {
    const usage = usageById.get(b.category_id);
    if (!usage) continue;
    usage.budgetMonths += 1;
    if (b.month === thisMonth) usage.currentLimit = b.limit_amount;
  }

  // Computed with the same function the action uses, so the form's preview is
  // the mark the next category will really be given.
  const nextMark = {
    expense: pickCategoryColor("expense", categories),
    income: pickCategoryColor("income", categories),
  };

  return (
    <div>
      <h1 className="mb-1 font-heading text-[32px] font-semibold">
        Categories
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">
        The headings every entry is filed under
      </p>

      <div className="grid items-start gap-7 lg:grid-cols-[340px_1fr]">
        <Card className="elev-sm">
          <CardContent>
            <p className="kicker mb-2.5">New category</p>
            <AddCategoryForm nextMark={nextMark} />
          </CardContent>
        </Card>

        <Card className="elev-sm py-0">
          <CategoryList categories={categories} usageById={usageById} />
        </Card>
      </div>
    </div>
  );
}

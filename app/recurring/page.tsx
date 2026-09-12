import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { AddRecurringForm } from "@/components/add-recurring-form";
import { RecurringList } from "@/components/recurring-list";
import { Card, CardContent } from "@/components/ui/card";

export default async function RecurringPage() {
  await ensureDefaultCategories();
  await materializeDueRecurring();

  const supabase = await createClient();
  const [categoriesRes, rulesRes] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("recurring_rules")
      .select("*")
      .order("next_run_on", { ascending: true }),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const rules = unwrap(rulesRes, "load recurring items");

  return (
    <div>
      <h1 className="mb-7 font-heading text-[32px] font-semibold">Recurring</h1>

      <div className="grid items-start gap-7 lg:grid-cols-[340px_1fr]">
        <Card className="elev-sm">
          <CardContent>
            <p className="kicker mb-2.5">New recurring item</p>
            <AddRecurringForm categories={categories} />
          </CardContent>
        </Card>

        <Card className="elev-sm py-0">
          <RecurringList rules={rules} categories={categories} />
        </Card>
      </div>
    </div>
  );
}

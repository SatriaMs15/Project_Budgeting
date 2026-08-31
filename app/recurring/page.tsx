import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { AddRecurringForm } from "@/components/add-recurring-form";
import { RecurringList } from "@/components/recurring-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New recurring item</CardTitle>
        </CardHeader>
        <CardContent>
          <AddRecurringForm categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring items</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringList rules={rules} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}

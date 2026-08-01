import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TransactionsPage() {
  await ensureDefaultCategories();
  await materializeDueRecurring();

  const supabase = await createClient();
  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm categories={categories ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList
            transactions={transactions ?? []}
            categories={categories ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

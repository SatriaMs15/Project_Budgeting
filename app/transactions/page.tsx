import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { Card, CardContent } from "@/components/ui/card";

export default async function TransactionsPage() {
  await ensureDefaultCategories();
  await materializeDueRecurring();

  const supabase = await createClient();
  const [categoriesRes, transactionsRes] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const transactions = unwrap(transactionsRes, "load transactions");

  return (
    <div>
      <h1 className="mb-7 font-heading text-[32px] font-semibold">
        Transactions
      </h1>

      {/* Form first in source order — on a narrow screen it stacks on top,
          which is where the most-used control belongs. */}
      <div className="grid items-start gap-7 lg:grid-cols-[340px_1fr]">
        <Card className="elev-sm">
          <CardContent>
            <p className="kicker mb-2.5">New entry</p>
            <TransactionForm categories={categories} />
          </CardContent>
        </Card>

        <Card className="elev-sm py-0">
          <TransactionList
            transactions={transactions}
            categories={categories}
          />
        </Card>
      </div>
    </div>
  );
}

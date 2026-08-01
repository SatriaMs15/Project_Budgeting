import { deleteTransaction } from "@/app/actions/transactions";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";
import { formatIDR } from "@/lib/format";
import type { Category, Transaction } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TransactionList({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet. Add your first one on the left.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {transactions.map((t) => {
        const category = t.category_id ? byId.get(t.category_id) : undefined;
        const isIncome = t.kind === "income";
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: category?.color ?? "#cbd5e1" }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {category?.name ?? "Uncategorized"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDate(t.occurred_on)}
                {t.note ? ` · ${t.note}` : ""}
              </p>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                isIncome ? "text-green-600" : "text-foreground"
              }`}
            >
              {isIncome ? "+" : "−"}
              {formatIDR(t.amount)}
            </span>
            <EditTransactionDialog transaction={t} categories={categories} />
            <form action={deleteTransaction}>
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                aria-label="Delete transaction"
                className="rounded p-1 text-muted-foreground hover:text-red-600"
              >
                ✕
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

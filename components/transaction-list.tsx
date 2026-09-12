"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTransaction } from "@/app/actions/transactions";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";
import { formatIDR } from "@/lib/format";
import { moneyInk } from "@/lib/chart-colors";
import { categoryColor } from "@/lib/category-colors";
import type { Category, Transaction } from "@/lib/supabase/types";

/** Compact numeric date — narrow enough for the register's 92px column. */
function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const PAGE = 9;

/** Shared column track, so header and rows always line up. */
const COLS =
  "grid grid-cols-[92px_1fr_150px_130px_66px] gap-3 min-w-[560px]";

export function TransactionList({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [visible, setVisible] = useState(PAGE);
  const byId = new Map(categories.map((c) => [c.id, c]));

  if (transactions.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Nothing recorded yet. Add your first entry on the left.
      </p>
    );
  }

  const shown = transactions.slice(0, visible);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-divider px-5 py-4">
        <p className="font-heading text-[19px] font-semibold">Register</p>
        <span className="text-xs text-muted-foreground">
          Showing {shown.length} of {transactions.length}
        </span>
      </div>

      {/* Fixed columns scroll inside their own container so a narrow viewport
          never breaks the page layout. */}
      <div className="overflow-x-auto">
        <div className={`${COLS} col-head border-b border-divider px-5 py-2.5`}>
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div>
          {shown.map((t) => {
            const category = t.category_id ? byId.get(t.category_id) : undefined;
            const isIncome = t.kind === "income";
            const color = categoryColor(category);
            return (
              <div
                key={t.id}
                className={`${COLS} row-hover items-center border-b border-divider px-5 py-2.5`}
              >
                <span className="text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(t.occurred_on)}
                </span>
                <span className="truncate text-[13.5px] font-semibold">
                  {t.note || category?.name || "—"}
                </span>
                <span className="tag-outline" style={{ color }}>
                  {category?.name ?? "Uncategorized"}
                </span>
                <span
                  className="text-right text-sm font-semibold tabular-nums"
                  style={{ color: moneyInk(t.kind) }}
                >
                  {isIncome ? "+" : "−"}
                  {formatIDR(t.amount)}
                </span>
                <span className="flex justify-end gap-0.5">
                  <EditTransactionDialog
                    transaction={t}
                    categories={categories}
                  />
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      aria-label="Delete transaction"
                      className="flex size-7 items-center justify-center rounded text-[color:var(--negative-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--negative-ink)_10%,transparent)]"
                    >
                      <Trash2 className="size-[13px]" strokeWidth={1.75} />
                    </button>
                  </form>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {visible < transactions.length && (
        <div className="border-t border-divider px-5 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="font-heading text-sm font-semibold text-[color:var(--accent)] hover:underline"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

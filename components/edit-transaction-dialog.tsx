"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateTransaction,
  type FormState,
} from "@/app/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Category, Kind, Transaction } from "@/lib/supabase/types";

const initialState: FormState = { ts: 0 };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function EditTransactionDialog({
  transaction,
  categories,
}: {
  transaction: Transaction;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(
    updateTransaction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(transaction.kind);

  // Close the dialog once a save succeeds.
  useEffect(() => {
    if (state.ts > 0 && !state.error) setOpen(false);
  }, [state.ts, state.error]);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Edit transaction"
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        ✎
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={transaction.id} />
          <input type="hidden" name="kind" value={kind} />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("expense")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                kind === "expense"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "text-muted-foreground"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setKind("income")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                kind === "income"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "text-muted-foreground"
              }`}
            >
              Income
            </button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`amount-${transaction.id}`}>Amount</Label>
            <MoneyInput
              id={`amount-${transaction.id}`}
              name="amount"
              defaultValue={transaction.amount}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`category-${transaction.id}`}>Category</Label>
            <select
              id={`category-${transaction.id}`}
              name="category_id"
              defaultValue={transaction.category_id ?? ""}
              className={selectClass}
            >
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`date-${transaction.id}`}>Date</Label>
              <Input
                id={`date-${transaction.id}`}
                name="occurred_on"
                type="date"
                defaultValue={transaction.occurred_on}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`note-${transaction.id}`}>Note</Label>
              <Input
                id={`note-${transaction.id}`}
                name="note"
                defaultValue={transaction.note ?? ""}
              />
            </div>
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

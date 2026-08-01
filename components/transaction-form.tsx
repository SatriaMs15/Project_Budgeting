"use client";

import { useActionState, useState } from "react";
import { addTransaction, type FormState } from "@/app/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category, Kind } from "@/lib/supabase/types";

const initialState: FormState = { ts: 0 };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function TransactionForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    addTransaction,
    initialState,
  );
  const [kind, setKind] = useState<Kind>("expense");
  const today = new Date().toISOString().slice(0, 10);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  return (
    // Remounting on each successful submit (new ts) clears every field.
    <form key={state.ts} action={formAction} className="grid gap-4">
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
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-2">
        <Label htmlFor="amount">Amount</Label>
        <MoneyInput id="amount" name="amount" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category_id">Category</Label>
        <select id="category_id" name="category_id" className={selectClass}>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="occurred_on">Date</Label>
          <Input
            id="occurred_on"
            name="occurred_on"
            type="date"
            defaultValue={today}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" name="note" placeholder="e.g. Lunch" />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add transaction"}
      </Button>
    </form>
  );
}

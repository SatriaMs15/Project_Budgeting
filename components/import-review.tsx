"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  importTransactions,
  type ImportState,
} from "@/app/actions/import";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category, Kind } from "@/lib/supabase/types";
import type { ProposedRow } from "@/lib/csv";

const initialState: ImportState = { ts: 0 };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type RowState = ProposedRow & { key: number };

/** One editable proposed transaction. Emits the parallel form fields the
 *  importTransactions action reads with getAll(). */
function ReviewRow({
  row,
  categories,
  onRemove,
}: {
  row: RowState;
  categories: Category[];
  onRemove: () => void;
}) {
  const [kind, setKind] = useState<Kind>(row.kind);

  const options = categories.filter((c) => c.kind === kind);
  const initialCategory =
    options.find((c) => c.name === row.suggested_category)?.id ?? "";
  const [categoryId, setCategoryId] = useState(initialCategory);

  // Switching kind changes the available categories — drop a now-invalid pick.
  function switchKind(next: Kind) {
    setKind(next);
    const stillValid = categories.some(
      (c) => c.id === categoryId && c.kind === next,
    );
    if (!stillValid) setCategoryId("");
  }

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border p-3 md:grid-cols-[130px_1fr_150px_140px_150px_auto] md:items-center md:border-0 md:border-b md:p-2">
      <input type="hidden" name="kind" value={kind} />

      <Input type="date" name="occurred_on" defaultValue={row.occurred_on} />

      <Input
        name="note"
        defaultValue={row.note}
        placeholder="Description"
        className="col-span-2 md:col-span-1"
      />

      <MoneyInput name="amount" defaultValue={row.amount} />

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => switchKind("expense")}
          className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
            kind === "expense"
              ? "border-red-500 bg-red-50 text-red-700"
              : "text-muted-foreground"
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => switchKind("income")}
          className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
            kind === "income"
              ? "border-green-500 bg-green-50 text-green-700"
              : "text-muted-foreground"
          }`}
        >
          Income
        </button>
      </div>

      <select
        name="category_id"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className={selectClass}
      >
        <option value="">Uncategorized</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end text-sm text-muted-foreground hover:text-red-600"
        aria-label="Remove row"
      >
        Remove
      </button>
    </div>
  );
}

export function ImportReview({
  rows: proposed,
  categories,
  onReset,
}: {
  rows: ProposedRow[];
  categories: Category[];
  onReset: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(
    proposed.map((r, i) => ({ ...r, key: i })),
  );
  const [state, formAction, pending] = useActionState(
    importTransactions,
    initialState,
  );

  const imported = state.ts > 0 && !state.error;

  useEffect(() => {
    if (imported) router.push("/transactions");
  }, [imported, router]);

  if (imported) {
    return (
      <p className="text-sm text-muted-foreground">Imported — taking you to Transactions…</p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} transaction{rows.length === 1 ? "" : "s"} found. Edit
        anything that looks off, set categories, then import.
      </p>

      <div className="grid gap-2">
        {rows.map((row) => (
          <ReviewRow
            key={row.key}
            row={row}
            categories={categories}
            onRemove={() =>
              setRows((rs) => rs.filter((r) => r.key !== row.key))
            }
          />
        ))}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending ? "Importing…" : `Import ${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
        </Button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Start over
        </button>
      </div>
    </form>
  );
}

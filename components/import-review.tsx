"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { importTransactions, type ImportState } from "@/app/actions/import";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moneyInk } from "@/lib/chart-colors";
import type { Category, Kind } from "@/lib/supabase/types";
import type { ProposedRow } from "@/lib/csv";

const initialState: ImportState = { ts: 0 };

/** Shared column track for the review table's header and rows. */
const COLS =
  "grid grid-cols-[100px_1fr_130px_110px_160px_70px] gap-3 min-w-[660px]";

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

  // The extractor returns "" when it couldn't match a known category — that's
  // the honest signal for "check this one" rather than a fabricated score.
  const lowConfidence = !row.suggested_category;

  // Switching kind changes the available categories — drop a now-invalid pick.
  function switchKind(next: Kind) {
    setKind(next);
    const stillValid = categories.some(
      (c) => c.id === categoryId && c.kind === next,
    );
    if (!stillValid) setCategoryId("");
  }

  return (
    <div className={`${COLS} items-center border-b border-divider px-5 py-3`}>
      <input type="hidden" name="kind" value={kind} />

      <Input
        type="date"
        name="occurred_on"
        defaultValue={row.occurred_on}
        className="h-[30px] px-1.5 text-[12.5px]"
      />

      <Input
        name="note"
        defaultValue={row.note}
        placeholder="Description"
        className="h-[30px] text-[13px]"
      />

      <MoneyInput name="amount" defaultValue={row.amount} className="h-[30px]" />

      {/* Kind reads as an outlined tag and toggles in place. */}
      <button
        type="button"
        onClick={() => switchKind(kind === "expense" ? "income" : "expense")}
        className="tag-outline"
        style={{ color: moneyInk(kind) }}
        aria-label={`Kind: ${kind}. Click to switch.`}
      >
        {kind === "income" ? "Income" : "Expense"}
      </button>

      <div>
        <NativeSelect
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-[30px]"
        >
          <option value="">Uncategorized</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        {lowConfidence && (
          <p className="mt-1 text-[10.5px] text-[color:var(--accent-700)]">
            Low confidence — check this one
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 items-center justify-self-end rounded text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-foreground"
        aria-label="Remove row"
      >
        <X className="m-auto size-[13px]" strokeWidth={1.75} />
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
      <p className="text-sm text-muted-foreground">
        Imported — taking you to the register…
      </p>
    );
  }

  return (
    <form action={formAction} className="rounded border border-divider">
      <p className="border-b border-divider px-5 py-4 text-[13px] text-muted-foreground">
        {rows.length} transaction{rows.length === 1 ? "" : "s"} found. Edit
        anything that looks off, then import.
      </p>

      <div className="overflow-x-auto">
        <div className={`${COLS} col-head border-b border-divider px-5 py-3`}>
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>Kind</span>
          <span>Category</span>
          <span />
        </div>

        {rows.map((row) => (
          <ReviewRow
            key={row.key}
            row={row}
            categories={categories}
            onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
          />
        ))}
      </div>

      {state.error && (
        <p className="px-5 pt-3 text-sm text-[color:var(--negative-ink)]">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending
            ? "Importing…"
            : `Import ${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          Start over
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, type FormState } from "@/app/actions/transactions";
import { KindToggle } from "@/components/kind-toggle";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGrouped } from "@/lib/format";
import type { Category, Kind } from "@/lib/supabase/types";

const initialState: FormState = { ts: 0 };

/** Everyday rupiah amounts, one tap away. */
const QUICK_AMOUNTS = [15_000, 50_000, 100_000, 250_000];

export function TransactionForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    addTransaction,
    initialState,
  );
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  // After a successful add, clear the amount. The `key` below remounts the
  // form's fields but not this component, so `amount` has to be reset here —
  // adjusted during render rather than in an effect, which avoids the extra
  // render pass an effect would cost.
  const [lastTs, setLastTs] = useState(state.ts);
  if (state.ts !== lastTs) {
    setLastTs(state.ts);
    if (!state.error) setAmount(0);
  }

  // Focus is a DOM effect, not state: put the caret back where the next entry
  // starts so several transactions can be logged without the mouse.
  useEffect(() => {
    if (state.ts > 0 && !state.error) amountRef.current?.focus();
  }, [state.ts, state.error]);

  /** Enter anywhere in Amount or Note submits, rather than doing nothing. */
  function submitOnEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    // Remounting on each successful submit (new ts) clears the text fields.
    <form key={state.ts} ref={formRef} action={formAction} className="grid gap-3.5">
      <KindToggle name="kind-toggle" value={kind} onChange={setKind} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-1.5">
        <Label htmlFor="amount" className="text-xs text-muted-foreground">
          Amount
        </Label>
        <MoneyInput
          id="amount"
          name="amount"
          required
          autoFocus
          inputRef={amountRef}
          value={amount}
          onValueChange={setAmount}
          onKeyDown={submitOnEnter}
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setAmount(q);
                amountRef.current?.focus();
              }}
              className="rounded-[3px] border border-divider px-1.5 py-[3px] text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              Rp {formatGrouped(q)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="category_id" className="text-xs text-muted-foreground">
          Category
        </Label>
        <NativeSelect id="category_id" name="category_id">
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {/* Last, not first: an uncontrolled <select> preselects its first
              option, and filing everything as Uncategorized by default would be
              worse than the gap this closes. It still leaves the control usable
              when every category of this kind has been deleted. */}
          <option value="">Uncategorized</option>
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="occurred_on" className="text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id="occurred_on"
            name="occurred_on"
            type="date"
            defaultValue={today}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="note" className="text-xs text-muted-foreground">
            Note
          </Label>
          <Input
            id="note"
            name="note"
            placeholder="e.g. Lunch"
            onKeyDown={submitOnEnter}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-[color:var(--negative-ink)]">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add transaction"}
      </Button>
    </form>
  );
}

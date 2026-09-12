"use client";

import { useActionState, useState } from "react";
import { addRule, type RecurringFormState } from "@/app/actions/recurring";
import { KindToggle } from "@/components/kind-toggle";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category, Kind } from "@/lib/supabase/types";

const initialState: RecurringFormState = { ts: 0 };
const labelClass = "text-xs text-muted-foreground";

export function AddRecurringForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(addRule, initialState);
  const [kind, setKind] = useState<Kind>("expense");
  const today = new Date().toISOString().slice(0, 10);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  return (
    <form key={state.ts} action={formAction} className="grid gap-3.5">
      <KindToggle name="rec-kind-toggle" value={kind} onChange={setKind} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-1.5">
        <Label htmlFor="rec-note" className={labelClass}>
          Description
        </Label>
        <Input id="rec-note" name="note" placeholder="e.g. Rent" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rec-amount" className={labelClass}>
          Amount
        </Label>
        <MoneyInput id="rec-amount" name="amount" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rec-category" className={labelClass}>
            Category
          </Label>
          <NativeSelect id="rec-category" name="category_id">
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rec-frequency" className={labelClass}>
            Cadence
          </Label>
          <NativeSelect
            id="rec-frequency"
            name="frequency"
            defaultValue="monthly"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rec-date" className={labelClass}>
          Starts on
        </Label>
        <Input
          id="rec-date"
          name="next_run_on"
          type="date"
          defaultValue={today}
        />
      </div>

      {state.error && (
        <p className="text-sm text-[color:var(--negative-ink)]">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create rule"}
      </Button>
    </form>
  );
}

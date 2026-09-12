"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { updateTransaction, type FormState } from "@/app/actions/transactions";
import { KindToggle } from "@/components/kind-toggle";
import { MoneyInput } from "@/components/money-input";
import { NativeSelect } from "@/components/ui/native-select";
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

const labelClass = "text-xs text-muted-foreground";

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

  // Close the dialog once a save succeeds. Adjusted during render rather than
  // in an effect, so React commits the close in the same pass.
  const [lastTs, setLastTs] = useState(state.ts);
  if (state.ts !== lastTs) {
    setLastTs(state.ts);
    if (!state.error) setOpen(false);
  }

  const visibleCategories = categories.filter((c) => c.kind === kind);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Edit transaction"
        className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-foreground"
      >
        <Pencil className="size-[13px]" strokeWidth={1.75} />
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-[20px] font-semibold">
            Edit transaction
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={transaction.id} />
          <input type="hidden" name="kind" value={kind} />

          <KindToggle
            name={`kind-${transaction.id}`}
            value={kind}
            onChange={setKind}
          />

          <div className="grid gap-1.5">
            <Label htmlFor={`note-${transaction.id}`} className={labelClass}>
              Description
            </Label>
            <Input
              id={`note-${transaction.id}`}
              name="note"
              defaultValue={transaction.note ?? ""}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`amount-${transaction.id}`} className={labelClass}>
              Amount
            </Label>
            <MoneyInput
              id={`amount-${transaction.id}`}
              name="amount"
              defaultValue={transaction.amount}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor={`category-${transaction.id}`}
                className={labelClass}
              >
                Category
              </Label>
              <NativeSelect
                id={`category-${transaction.id}`}
                name="category_id"
                defaultValue={transaction.category_id ?? ""}
              >
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`date-${transaction.id}`} className={labelClass}>
                Date
              </Label>
              <Input
                id={`date-${transaction.id}`}
                name="occurred_on"
                type="date"
                defaultValue={transaction.occurred_on}
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-[color:var(--negative-ink)]">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="secondary" type="button" />}>
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

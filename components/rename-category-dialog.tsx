"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import {
  renameCategory,
  type CategoryFormState,
} from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Category } from "@/lib/supabase/types";

const initialState: CategoryFormState = { ts: 0 };

export function RenameCategoryDialog({ category }: { category: Category }) {
  const [state, formAction, pending] = useActionState(
    renameCategory,
    initialState,
  );
  const [open, setOpen] = useState(false);

  // Close once a rename succeeds. Adjusted during render rather than in an
  // effect, so React commits the close in the same pass.
  const [lastTs, setLastTs] = useState(state.ts);
  if (state.ts !== lastTs) {
    setLastTs(state.ts);
    if (!state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Rename ${category.name}`}
        className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-foreground"
      >
        <Pencil className="size-[13px]" strokeWidth={1.75} />
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-[20px] font-semibold">
            Rename category
          </DialogTitle>
          <DialogDescription>
            Existing transactions, budgets and recurring items keep their link —
            only the label changes.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={category.id} />

          <div className="grid gap-1.5">
            <Label
              htmlFor={`rename-${category.id}`}
              className="text-xs text-muted-foreground"
            >
              Name
            </Label>
            <Input
              id={`rename-${category.id}`}
              name="name"
              defaultValue={category.name}
              maxLength={40}
              required
            />
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

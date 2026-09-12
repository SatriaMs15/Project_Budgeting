"use client";

import { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteCategory } from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  describeCategoryDeletion,
  type CategoryUsage,
} from "@/lib/category-usage";
import type { Category } from "@/lib/supabase/types";

/**
 * Deleting a category is the one destructive act in the app that silently takes
 * something else with it: budget limits cascade. So this never deletes on the
 * first click — it shows exactly what is about to be lost, counted from the
 * user's own data, and asks again.
 */
export function DeleteCategoryDialog({
  category,
  usage,
}: {
  category: Category;
  usage: CategoryUsage;
}) {
  const [open, setOpen] = useState(false);
  const { destroyed, preserved } = describeCategoryDeletion(usage);
  const untouched = destroyed.length === 0 && preserved.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Not a DialogTrigger: Base UI's trigger renders a <button> that would
          submit the row's own form if this ever sat inside one. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${category.name}`}
        className="flex size-7 items-center justify-center rounded text-[color:var(--negative-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--negative-ink)_10%,transparent)]"
      >
        <Trash2 className="size-[13px]" strokeWidth={1.75} />
      </button>

      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-[20px] font-semibold">
            Delete “{category.name}”?
          </DialogTitle>
        </DialogHeader>

        {untouched ? (
          <p className="text-[13.5px] text-muted-foreground">
            Nothing is filed under this category yet, so nothing else changes.
          </p>
        ) : (
          <div className="grid gap-3">
            {destroyed.length > 0 && (
              <div className="flex gap-2.5 rounded border border-[color-mix(in_srgb,var(--negative-ink)_45%,transparent)] bg-[color-mix(in_srgb,var(--negative-ink)_7%,transparent)] p-3">
                <TriangleAlert
                  className="mt-px size-4 shrink-0 text-[color:var(--negative-ink)]"
                  strokeWidth={1.75}
                />
                <div className="grid gap-1">
                  <p className="kicker text-[color:var(--negative-ink)]">
                    This cannot be undone
                  </p>
                  {destroyed.map((line) => (
                    <p
                      key={line}
                      className="text-[13.5px] text-[color:var(--negative-ink)]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {preserved.length > 0 && (
              <div className="grid gap-1">
                <p className="kicker-muted">Kept</p>
                {preserved.map((line) => (
                  <p key={line} className="text-[13.5px] text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" type="button" />}>
            Cancel
          </DialogClose>
          <form action={deleteCategory}>
            <input type="hidden" name="id" value={category.id} />
            <Button
              type="submit"
              variant="destructive"
              className="w-full border-[color:var(--negative-ink)]"
            >
              Delete category
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

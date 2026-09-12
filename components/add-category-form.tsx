"use client";

import { useActionState, useState } from "react";
import { addCategory, type CategoryFormState } from "@/app/actions/categories";
import { KindToggle } from "@/components/kind-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Kind } from "@/lib/supabase/types";

const initialState: CategoryFormState = { ts: 0 };
const labelClass = "text-xs text-muted-foreground";

/**
 * Colours are assigned by the server, not chosen here — so the form shows the
 * mark the new category is actually about to get. `nextMark` is computed on the
 * page from the same function the action uses, and the page re-renders after
 * every add, so the preview keeps pace as the palette advances.
 */
export function AddCategoryForm({
  nextMark,
}: {
  nextMark: Record<Kind, string>;
}) {
  const [state, formAction, pending] = useActionState(
    addCategory,
    initialState,
  );
  const [kind, setKind] = useState<Kind>("expense");
  const [name, setName] = useState("");

  // Clear the field once an add succeeds. The name is component state driving a
  // controlled input, so a `key` on the <form> would not reset it — only the
  // DOM node would remount. Adjusted during render rather than in an effect, so
  // React commits the cleared field in the same pass. The kind is left as it
  // was, since adding several categories of one kind in a row is the common
  // case; a failed add keeps the text so it can be corrected.
  const [lastTs, setLastTs] = useState(state.ts);
  if (state.ts !== lastTs) {
    setLastTs(state.ts);
    if (!state.error) setName("");
  }

  return (
    <form action={formAction} className="grid gap-3.5">
      <KindToggle name="cat-kind-toggle" value={kind} onChange={setKind} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-1.5">
        <Label htmlFor="cat-name" className={labelClass}>
          Name
        </Label>
        <Input
          id="cat-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={kind === "expense" ? "e.g. Groceries" : "e.g. Freelance"}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <span className={labelClass}>Mark</span>
        <div className="flex items-center gap-2.5">
          <span className="tag-outline" style={{ color: nextMark[kind] }}>
            {name.trim() || "Preview"}
          </span>
          <span className="text-[11.5px] text-muted-foreground">
            Assigned for you
          </span>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-[color:var(--negative-ink)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add category"}
      </Button>
    </form>
  );
}

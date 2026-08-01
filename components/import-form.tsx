"use client";

import { useActionState, useState } from "react";
import {
  extractTransactions,
  type ExtractState,
} from "@/app/actions/import";
import { ImportReview } from "@/components/import-review";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/supabase/types";

const initialState: ExtractState = { ts: 0 };

const inputClass =
  "block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted";

export function ImportForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    extractTransactions,
    initialState,
  );
  // Track which result the user dismissed via "Start over".
  const [dismissedTs, setDismissedTs] = useState(0);

  const showReview =
    state.rows && state.rows.length > 0 && state.ts !== dismissedTs;

  if (showReview) {
    return (
      <div className="grid gap-3">
        {state.notice && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {state.notice}
          </p>
        )}
        <ImportReview
          rows={state.rows!}
          categories={categories}
          onReset={() => setDismissedTs(state.ts)}
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,application/pdf,image/png,image/jpeg,image/webp"
          required
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          CSV, PDF, or a photo of a statement/receipt. Nothing is saved until
          you review and confirm.
        </p>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Reading…" : "Extract transactions"}
      </Button>
    </form>
  );
}

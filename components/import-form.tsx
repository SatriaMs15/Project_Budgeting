"use client";

import { useActionState, useRef, useState } from "react";
import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { extractTransactions, type ExtractState } from "@/app/actions/import";
import { ImportReview } from "@/components/import-review";
import { Button } from "@/components/ui/button";
import { CHART } from "@/lib/chart-colors";
import type { Category } from "@/lib/supabase/types";

const initialState: ExtractState = { ts: 0 };

/** Outlined status medallion — the shared shape for idle/error states. */
function Medallion({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border"
      style={{ borderColor: color }}
    >
      {children}
    </span>
  );
}

export function ImportForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(
    extractTransactions,
    initialState,
  );
  // Track which result the user dismissed via "Start over".
  const [dismissedTs, setDismissedTs] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showReview =
    state.rows && state.rows.length > 0 && state.ts !== dismissedTs;

  // Extracting — the model can take a while, so say so rather than just spin.
  if (pending) {
    return (
      <div className="rounded border border-divider px-5 py-11 text-center">
        <Loader2
          className="mx-auto mb-3 size-[26px] animate-spin"
          strokeWidth={1.5}
          style={{ color: CHART.accent }}
        />
        <p className="text-sm font-semibold">Reading your statement</p>
        <p className="text-[12.5px] text-muted-foreground">
          This can take up to a minute.
        </p>
      </div>
    );
  }

  if (showReview) {
    return (
      <div className="grid gap-3">
        {state.notice && (
          <p className="rounded border border-divider px-3 py-2 text-[13px] text-muted-foreground">
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

  // Error — recoverable, so the only action is to try a different file.
  if (state.error) {
    return (
      <div className="rounded border border-divider px-5 py-11 text-center">
        <Medallion color={CHART.negative}>
          <AlertTriangle
            className="size-[19px]"
            strokeWidth={1.5}
            style={{ color: CHART.negative }}
          />
        </Medallion>
        <p className="mb-1 text-sm font-semibold">Couldn&apos;t read that file</p>
        <p className="mx-auto mb-3.5 max-w-[340px] text-[12.5px] text-muted-foreground">
          {state.error}
        </p>
        <form action={formAction} ref={formRef}>
          <input
            ref={fileRef}
            type="file"
            name="file"
            required
            className="hidden"
            accept=".csv,text/csv,application/pdf,image/png,image/jpeg,image/webp"
            onChange={() => formRef.current?.requestSubmit()}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
          >
            Try another file
          </Button>
        </form>
      </div>
    );
  }

  // Idle — a dashed dropzone that opens the picker; the form self-submits as
  // soon as a file is chosen, so there's no second "now upload it" step.
  return (
    <form
      action={formAction}
      ref={formRef}
      className="rounded border border-dashed border-divider px-5 py-11 text-center"
    >
      <Medallion color={CHART.accent}>
        <UploadCloud
          className="size-[19px]"
          strokeWidth={1.5}
          style={{ color: CHART.accentInk }}
        />
      </Medallion>
      <p className="mb-1 text-sm font-semibold">Drop a bank statement here</p>
      <p className="mb-3.5 text-[12.5px] text-muted-foreground">
        CSV, PDF, or a photo of a receipt — up to 10MB. Nothing is saved until
        you review it.
      </p>
      <input
        ref={fileRef}
        type="file"
        name="file"
        required
        className="hidden"
        accept=".csv,text/csv,application/pdf,image/png,image/jpeg,image/webp"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => fileRef.current?.click()}
      >
        Browse files
      </Button>
    </form>
  );
}

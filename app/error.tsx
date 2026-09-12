"use client";

import { useEffect, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHART } from "@/lib/chart-colors";

/**
 * Route-level error boundary. Covers every page under app/, so a failed query
 * shows as a failure instead of an empty state.
 *
 * Next only forwards `error.message` from Server Components in development —
 * in production it is replaced by a generic string plus a `digest` — so the
 * copy below has to stand on its own rather than lean on the message.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // useTransition already reports whether the retry is in flight, and it
  // clears itself when the attempt settles — so a failed retry re-enables the
  // button without any state of our own to reset.
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-10">
      <div className="elev-md rounded border border-divider bg-card px-8 py-14 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 flex size-[52px] items-center justify-center rounded-full border"
          style={{ borderColor: CHART.negative }}
        >
          <AlertTriangle
            className="size-[22px]"
            strokeWidth={1.5}
            style={{ color: CHART.negative }}
          />
        </span>

        <p className="mb-1.5 font-heading text-[20px] font-semibold">
          Something went wrong
        </p>
        <p className="mx-auto mb-5 max-w-[360px] text-[13.5px] text-muted-foreground">
          We can&apos;t reach your data right now. This usually clears up in a
          minute — try again.
        </p>

        {/* Dev-only detail. In production this message is a generic placeholder. */}
        {process.env.NODE_ENV === "development" && (
          <pre className="mb-5 max-w-full overflow-x-auto rounded border border-divider px-3 py-2 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}

        <Button
          disabled={pending}
          onClick={() => startTransition(() => unstable_retry())}
        >
          {pending ? "Retrying…" : "Try again"}
        </Button>

        {error.digest && (
          <p className="mt-5 text-[11px] text-muted-foreground">
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}

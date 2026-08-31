"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="animate-in fade-in zoom-in-95 duration-500">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>

        <div className="grid gap-1.5">
          <p className="font-medium">Couldn&apos;t load your data</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            This is a connection or database problem, not an empty account —
            your transactions are safe. A paused Supabase project is the usual
            cause; free projects sleep after about a week of inactivity.
          </p>
        </div>

        {/* Dev-only detail. In production this message is a generic placeholder. */}
        {process.env.NODE_ENV === "development" && (
          <pre className="max-w-full overflow-x-auto rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}

        <Button onClick={() => unstable_retry()} className="gap-1.5">
          <RotateCw className="size-4" />
          Try again
        </Button>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

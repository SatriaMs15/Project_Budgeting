import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A native <select> styled as a ledger field.
 *
 * The design calls for a plain dropdown, and these live inside server-action
 * forms that post their value by `name` — so the native element is the right
 * tool here, rather than the Base UI Select (which needs a hidden input and
 * client state to do the same job).
 */
function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full min-w-0 rounded border border-divider bg-transparent px-2 py-1.5 text-sm text-foreground transition-colors outline-none hover:border-[color-mix(in_srgb,var(--ink)_45%,transparent)] focus-visible:border-[color:var(--accent)] focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }

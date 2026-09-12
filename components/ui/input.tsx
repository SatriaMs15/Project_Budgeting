import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Ledger field: a hairline box on the paper ground, no fill and no shadow.
 * The caret picks up the gold accent; the border does too on focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded border border-divider bg-transparent px-2.5 py-1.5 text-sm text-foreground caret-[color:var(--accent)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-[color-mix(in_srgb,var(--ink)_45%,transparent)] focus-visible:border-[color:var(--accent)] focus-visible:outline-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[color:var(--negative-ink)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }

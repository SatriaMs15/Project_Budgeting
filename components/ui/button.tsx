import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Ledger buttons are OUTLINED, never filled — a filled block reads as UI
 * chrome against the paper ground. "default" is the gold primary: gold border,
 * gold text, transparent fill, warming to a tint on hover.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded border bg-transparent font-heading text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] active:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]",
        outline:
          "border-divider text-foreground hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]",
        secondary:
          "border-divider text-foreground hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]",
        ghost:
          "border-transparent text-[color:var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
        destructive:
          "border-transparent text-[color:var(--negative-ink)] hover:bg-[color-mix(in_srgb,var(--negative-ink)_10%,transparent)]",
        link: "border-transparent text-[color:var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[30px] gap-1 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4",
        icon: "size-9 p-0",
        "icon-xs": "size-7 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

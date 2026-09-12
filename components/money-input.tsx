"use client";

import { useState, type Ref } from "react";
import { Input } from "@/components/ui/input";
import { formatGrouped, parseIDR } from "@/lib/format";

/**
 * Rupiah amount input. Shows thousand separators as the user types
 * ("1.250.000") while submitting the raw integer via a hidden field.
 *
 * Works uncontrolled by default. Pass `value`/`onValueChange` to drive it from
 * outside — the Transactions form does that so its quick-amount chips can fill
 * the field, and so focus can return here after a successful add.
 */
export function MoneyInput({
  name,
  id,
  defaultValue = 0,
  required,
  value,
  onValueChange,
  autoFocus,
  inputRef,
  className,
  onKeyDown,
}: {
  name: string;
  id?: string;
  defaultValue?: number;
  required?: boolean;
  value?: number;
  onValueChange?: (amount: number) => void;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const amount = controlled ? value : internal;

  function set(next: number) {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        ref={inputRef}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="0"
        className={`pl-8 text-right tabular-nums ${className ?? ""}`}
        value={amount > 0 ? formatGrouped(amount) : ""}
        onChange={(e) => set(parseIDR(e.target.value))}
        onKeyDown={onKeyDown}
        required={required}
      />
      <input type="hidden" name={name} value={amount} />
    </div>
  );
}

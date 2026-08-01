"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatGrouped, parseIDR } from "@/lib/format";

/**
 * Rupiah amount input. Shows thousand separators as the user types
 * ("1.250.000") while submitting the raw integer via a hidden field.
 */
export function MoneyInput({
  name,
  id,
  defaultValue = 0,
  required,
}: {
  name: string;
  id?: string;
  defaultValue?: number;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(
    defaultValue > 0 ? formatGrouped(defaultValue) : "",
  );
  const raw = parseIDR(display);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        className="pl-9"
        value={display}
        onChange={(e) => {
          const n = parseIDR(e.target.value);
          setDisplay(n === 0 ? "" : formatGrouped(n));
        }}
        required={required}
      />
      <input type="hidden" name={name} value={raw} />
    </div>
  );
}

"use client";

import type { Kind } from "@/lib/supabase/types";

/**
 * Expense/Income segmented control, built on native radios so keyboard and
 * screen-reader behaviour come for free. Selection is shown by a gold inset
 * outline rather than a filled block — filled pills are the pattern this
 * design deliberately avoids.
 */
export function KindToggle({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Kind;
  onChange: (kind: Kind) => void;
}) {
  return (
    <div className="seg">
      <label className="seg-opt">
        <input
          type="radio"
          name={name}
          value="expense"
          checked={value === "expense"}
          onChange={() => onChange("expense")}
        />
        <span>Expense</span>
      </label>
      <label className="seg-opt">
        <input
          type="radio"
          name={name}
          value="income"
          checked={value === "income"}
          onChange={() => onChange("income")}
        />
        <span>Income</span>
      </label>
    </div>
  );
}

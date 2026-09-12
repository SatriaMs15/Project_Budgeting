import { OctagonX } from "lucide-react";
import { deleteRule } from "@/app/actions/recurring";
import { formatIDR } from "@/lib/format";
import { moneyInk } from "@/lib/chart-colors";
import { categoryColor } from "@/lib/category-colors";
import type { Category, RecurringRule } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Shared column track for the recurring table's header and rows. */
const COLS =
  "grid grid-cols-[1fr_130px_130px_110px_130px_60px] gap-3 min-w-[640px]";

export function RecurringList({
  rules,
  categories,
}: {
  rules: RecurringRule[];
  categories: Category[];
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  if (rules.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Nothing repeating yet. Add rent or a salary so it posts itself each
        month.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className={`${COLS} col-head border-b border-divider px-5 py-3.5`}>
        <span>Description</span>
        <span>Category</span>
        <span className="text-right">Amount</span>
        <span>Cadence</span>
        <span>Next run</span>
        <span />
      </div>

      {rules.map((r) => {
        const category = r.category_id ? byId.get(r.category_id) : undefined;
        const color = categoryColor(category);
        return (
          <div
            key={r.id}
            className={`${COLS} row-hover items-center border-b border-divider px-5 py-3.5`}
          >
            <span className="truncate text-[13.5px] font-semibold">
              {r.note || category?.name || "—"}
            </span>
            <span className="tag-outline" style={{ color }}>
              {category?.name ?? "Uncategorized"}
            </span>
            <span
              className="text-right text-sm font-semibold tabular-nums"
              style={{ color: moneyInk(r.kind) }}
            >
              {r.kind === "income" ? "+" : "−"}
              {formatIDR(r.amount)}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {r.frequency === "monthly" ? "Monthly" : "Weekly"}
            </span>
            <span className="text-[13px] tabular-nums">
              {formatDate(r.next_run_on)}
            </span>
            <form action={deleteRule} className="flex justify-end">
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                aria-label={`Stop ${r.note || "recurring item"}`}
                className="flex size-7 items-center justify-center rounded text-[color:var(--negative-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--negative-ink)_10%,transparent)]"
              >
                <OctagonX className="size-[13px]" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

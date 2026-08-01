import { deleteRule } from "@/app/actions/recurring";
import { formatIDR } from "@/lib/format";
import type { Category, RecurringRule } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
      <p className="py-8 text-center text-sm text-muted-foreground">
        No recurring items yet. Add things like rent or salary so they repeat
        automatically.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {rules.map((r) => {
        const category = r.category_id ? byId.get(r.category_id) : undefined;
        const isIncome = r.kind === "income";
        return (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: category?.color ?? "#cbd5e1" }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {category?.name ?? "Uncategorized"}
                {r.note ? ` · ${r.note}` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.frequency === "monthly" ? "Monthly" : "Weekly"} · next{" "}
                {formatDate(r.next_run_on)}
              </p>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                isIncome ? "text-green-600" : "text-foreground"
              }`}
            >
              {isIncome ? "+" : "−"}
              {formatIDR(r.amount)}
            </span>
            <form action={deleteRule}>
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                aria-label="Delete recurring rule"
                className="rounded p-1 text-muted-foreground hover:text-red-600"
              >
                ✕
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

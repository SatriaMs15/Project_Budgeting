import { RenameCategoryDialog } from "@/components/rename-category-dialog";
import { DeleteCategoryDialog } from "@/components/delete-category-dialog";
import { categoryColor } from "@/lib/category-colors";
import { NO_USAGE, type CategoryUsage } from "@/lib/category-usage";
import { formatIDR } from "@/lib/format";
import type { Category, Kind } from "@/lib/supabase/types";

/**
 * Shared column track for the category ledger's header and rows.
 *
 * Limit gets 150px for the same reason the recurring table's amount column
 * does: "Rp 125.000.000" is nine digits plus the symbol, and a tighter track
 * clips it.
 */
const COLS =
  "grid grid-cols-[1fr_112px_112px_150px_72px] gap-3 items-center min-w-[660px]";

/** Plurals are spelled out rather than suffixed — "entry" does not take an -s. */
function UsageCell({
  count,
  one,
  many,
}: {
  count: number;
  one: string;
  many: string;
}) {
  return count === 0 ? (
    <span className="text-[13px] text-muted-foreground">—</span>
  ) : (
    <span className="text-[13px] tabular-nums">
      {count}{" "}
      <span className="text-muted-foreground">{count === 1 ? one : many}</span>
    </span>
  );
}

function Section({
  title,
  categories,
  usageById,
}: {
  title: string;
  categories: Category[];
  usageById: Map<string, CategoryUsage>;
}) {
  return (
    <section>
      <div className="border-b border-divider px-5 pt-5 pb-2.5">
        <p className="kicker">{title}</p>
      </div>

      <div className={`${COLS} col-head border-b border-divider px-5 py-3`}>
        <span>Category</span>
        <span>Transactions</span>
        <span>Recurring</span>
        <span className="text-right">Limit this month</span>
        <span />
      </div>

      {categories.length === 0 ? (
        <p className="px-5 py-7 text-sm text-muted-foreground">
          No {title.toLowerCase()} categories.
        </p>
      ) : (
        categories.map((category) => {
          const usage = usageById.get(category.id) ?? NO_USAGE;
          return (
            <div
              key={category.id}
              className={`${COLS} row-hover border-b border-divider px-5 py-3`}
            >
              <span
                className="tag-outline"
                style={{ color: categoryColor(category) }}
              >
                {category.name}
              </span>

              <UsageCell
                count={usage.transactions}
                one="entry"
                many="entries"
              />
              <UsageCell count={usage.recurring} one="rule" many="rules" />

              <span className="text-right text-[13px] tabular-nums">
                {usage.currentLimit !== null ? (
                  formatIDR(usage.currentLimit)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>

              <span className="flex justify-end gap-0.5">
                <RenameCategoryDialog category={category} />
                <DeleteCategoryDialog category={category} usage={usage} />
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}

export function CategoryList({
  categories,
  usageById,
}: {
  categories: Category[];
  usageById: Map<string, CategoryUsage>;
}) {
  const byKind = (kind: Kind) => categories.filter((c) => c.kind === kind);

  if (categories.length === 0) {
    return (
      <p className="px-5 py-12 text-center text-sm text-muted-foreground">
        You have no categories. Add one on the left to start filing entries
        again.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-1">
      <Section
        title="Expense"
        categories={byKind("expense")}
        usageById={usageById}
      />
      <Section
        title="Income"
        categories={byKind("income")}
        usageById={usageById}
      />
    </div>
  );
}

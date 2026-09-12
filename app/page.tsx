import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { monthStart, nextMonthStart, monthLabel } from "@/lib/date";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";
import { categoryColor } from "@/lib/category-colors";
import { MonthlyBarChart } from "@/components/charts/monthly-bars";
import { CategoryLedger } from "@/components/charts/category-ledger";

/**
 * One column of the stat row. Bare figures separated by hairlines — no boxes,
 * no icon chips: the numbers are the interface.
 */
function Stat({
  label,
  amount,
  sign,
  dot,
  ink,
  className = "",
}: {
  label: string;
  amount: number;
  sign: string;
  dot: string;
  ink: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-[7px] text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <span
          aria-hidden
          className="size-[7px] rounded-full"
          style={{ backgroundColor: dot }}
        />
        {label}
      </p>
      <p
        className="mt-2 font-heading text-[34px] font-semibold leading-none tabular-nums"
        style={{ color: ink }}
      >
        {sign}
        {formatIDR(amount)}
      </p>
    </div>
  );
}

export default async function Home() {
  await ensureDefaultCategories();
  await materializeDueRecurring();
  const supabase = await createClient();

  const now = new Date();
  const ms = monthStart(now);
  const nms = nextMonthStart(now);

  // Six month buckets, oldest -> newest.
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      income: 0,
      expense: 0,
    };
  });
  const windowStart = `${buckets[0].key}-01`;

  const [categoriesRes, txnsRes] = await Promise.all([
    supabase.from("categories").select("id, name, kind"),
    supabase
      .from("transactions")
      .select("amount, kind, category_id, occurred_on")
      .gte("occurred_on", windowStart)
      .lt("occurred_on", nms),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const txns = unwrap(txnsRes, "load transactions");

  const catById = new Map(categories.map((c) => [c.id, c]));

  /**
   * Bucket key for spending with no category. Deleting a category sets its
   * transactions' category_id to NULL (0001_init.sql), and those rupiah are
   * still real spending: skipping them left the breakdown silently short of
   * the Expenses tile above it, with nothing on screen to explain the gap.
   */
  const UNCATEGORIZED = "\u0000uncategorized";
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  let monthIncome = 0;
  let monthExpense = 0;
  const catSpend = new Map<string, number>();

  for (const t of txns) {
    const b = bucketByKey.get(t.occurred_on.slice(0, 7));
    if (b) {
      if (t.kind === "income") b.income += t.amount;
      else b.expense += t.amount;
    }
    if (t.occurred_on >= ms) {
      if (t.kind === "income") {
        monthIncome += t.amount;
      } else {
        monthExpense += t.amount;
        const key = t.category_id ?? UNCATEGORIZED;
        catSpend.set(key, (catSpend.get(key) ?? 0) + t.amount);
      }
    }
  }

  const net = monthIncome - monthExpense;
  const categoryData = [...catSpend.entries()]
    .map(([id, amount]) => {
      const c = id === UNCATEGORIZED ? undefined : catById.get(id);
      return {
        name: c?.name ?? "Uncategorized",
        amount,
        color: categoryColor(c),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const hasAny = txns.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <span
          aria-hidden
          className="flex size-[52px] items-center justify-center rounded-full border"
          style={{ borderColor: CHART.accent }}
        >
          <BookOpen
            className="size-[22px]"
            strokeWidth={1.5}
            style={{ color: CHART.accentInk }}
          />
        </span>
        <p className="max-w-[320px] text-sm text-muted-foreground">
          No transactions yet. Add a few to open this month&apos;s ledger.
        </p>
        <Link
          href="/transactions"
          className="rounded border px-4 py-2 font-heading text-sm font-semibold transition-colors"
          style={{ borderColor: CHART.accent, color: CHART.accent }}
        >
          Add your first transaction
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* The month is the headline; "Dashboard" is only a kicker above it. */}
      <p className="kicker-muted mb-1">Dashboard</p>
      <h1 className="mb-8 font-heading text-[38px] font-semibold">
        {monthLabel(now)}
      </h1>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3">
        <Stat
          label="Income"
          amount={monthIncome}
          sign="+"
          dot={CHART.income}
          ink={CHART.incomeInk}
          className="pb-3 sm:pb-0 sm:pr-8"
        />
        <Stat
          label="Expenses"
          amount={monthExpense}
          sign="−"
          dot={CHART.expense}
          ink={CHART.expenseInk}
          className="border-t border-divider py-3 sm:border-t-0 sm:border-l sm:px-8 sm:py-0"
        />
        {/* Net gets a direction cue of its own — teal up, brick down — kept
            distinct from the income/expense pair so it never reads as a third
            category of money. */}
        <Stat
          label="Net"
          amount={Math.abs(net)}
          sign={net >= 0 ? "+" : "−"}
          dot={net >= 0 ? CHART.incomeInk : CHART.negative}
          ink={net >= 0 ? CHART.incomeInk : CHART.negative}
          className="border-t border-divider pt-3 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0"
        />
      </div>

      <hr className="mb-8 border-t border-divider" />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="mb-5 font-heading text-[19px] font-semibold">
            Income vs expense — six months
          </h2>
          <MonthlyBarChart data={buckets} />
        </section>

        <section>
          <h2 className="mb-5 font-heading text-[19px] font-semibold">
            Spending by category ·{" "}
            {now.toLocaleDateString("id-ID", { month: "long" })}
          </h2>
          <CategoryLedger data={categoryData} />
        </section>
      </div>
    </div>
  );
}

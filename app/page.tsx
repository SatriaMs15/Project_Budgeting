import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  ChartColumnBig,
  Sparkles,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { materializeDueRecurring } from "@/lib/recurring";
import { monthStart, nextMonthStart, monthLabel } from "@/lib/date";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";
import { buttonVariants } from "@/components/ui/button";
import { CategoryBarChart } from "@/components/charts/category-bar";
import { MonthlyBarChart } from "@/components/charts/monthly-bars";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Tile({
  label,
  amount,
  color,
  sign,
  Icon,
  delay = 0,
}: {
  label: string;
  amount: number;
  color?: string;
  sign?: string;
  Icon: LucideIcon;
  delay?: number;
}) {
  const tint = color ?? "var(--muted-foreground)";
  return (
    <Card
      className="relative overflow-hidden animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Accent rail keyed to the tile's meaning (income/expense/net). */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: tint }}
      />
      <CardContent className="flex items-center justify-between py-5 pl-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: tint }}
            />
            {label}
          </p>
          <p
            className="mt-1.5 text-2xl font-semibold tabular-nums"
            style={color ? { color } : undefined}
          >
            {sign}
            {formatIDR(amount)}
          </p>
        </div>
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `${color ?? "#64748b"}1a`, color: tint }}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
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
    supabase.from("categories").select("id, name"),
    supabase
      .from("transactions")
      .select("amount, kind, category_id, occurred_on")
      .gte("occurred_on", windowStart)
      .lt("occurred_on", nms),
  ]);
  const categories = unwrap(categoriesRes, "load categories");
  const txns = unwrap(txnsRes, "load transactions");

  const catName = new Map(categories.map((c) => [c.id, c.name]));
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
        if (t.category_id) {
          catSpend.set(
            t.category_id,
            (catSpend.get(t.category_id) ?? 0) + t.amount,
          );
        }
      }
    }
  }

  const net = monthIncome - monthExpense;
  const categoryData = [...catSpend.entries()]
    .map(([id, amount]) => ({ name: catName.get(id) ?? "Uncategorized", amount }))
    .sort((a, b) => b.amount - a.amount);

  const hasAny = txns.length > 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{monthLabel(now)}</p>
      </div>

      {!hasAny ? (
        <Card className="animate-in fade-in zoom-in-95 duration-500">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent text-primary">
              <Sparkles className="size-7" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              No transactions yet. Add a few to watch your dashboard come to
              life.
            </p>
            <Link
              href="/transactions"
              className={`${buttonVariants()} gap-1.5`}
            >
              <Plus className="size-4" />
              Add your first transaction
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile
              label="Income"
              amount={monthIncome}
              color={CHART.income}
              sign="+"
              Icon={TrendingUp}
              delay={0}
            />
            <Tile
              label="Expenses"
              amount={monthExpense}
              color={CHART.expense}
              sign="−"
              Icon={TrendingDown}
              delay={80}
            />
            <Tile
              label="Net"
              amount={Math.abs(net)}
              color={net >= 0 ? CHART.positive : CHART.negative}
              sign={net >= 0 ? "+" : "−"}
              Icon={Wallet}
              delay={160}
            />
          </div>

          <Card
            className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
            style={{ animationDelay: "240ms" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                Income vs expense
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBarChart data={buckets} />
            </CardContent>
          </Card>

          <Card
            className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
            style={{ animationDelay: "320ms" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartColumnBig className="size-4 text-primary" />
                Spending by category · {monthLabel(now)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBarChart data={categoryData} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

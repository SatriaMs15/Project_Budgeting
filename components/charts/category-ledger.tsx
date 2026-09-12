import { formatIDR } from "@/lib/format";

type Datum = { name: string; amount: number; color: string };

/**
 * Spending by category as a numbered ledger list, not a bar chart: rank,
 * name, a dotted leader across the gap, then the figure — the way a book's
 * table of contents sets an entry. The 2px rule beneath each row carries the
 * comparison, scaled against the largest category.
 */
export function CategoryLedger({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        No spending recorded this month yet.
      </p>
    );
  }

  const top = data[0].amount;

  return (
    <div>
      {data.map((c, i) => (
        <div key={c.name} className="border-b border-divider py-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="w-[18px] shrink-0 font-heading text-[13px] text-[color:var(--accent-700)] tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="shrink-0 text-sm">{c.name}</span>
            <span aria-hidden className="leader" />
            <span className="shrink-0 text-sm tabular-nums">
              {formatIDR(c.amount)}
            </span>
          </div>
          <div className="ml-[28px] mt-1.5 h-0.5 overflow-hidden rounded-sm bg-divider">
            <div
              className="h-full"
              style={{
                width: `${top > 0 ? (c.amount / top) * 100 : 0}%`,
                backgroundColor: c.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

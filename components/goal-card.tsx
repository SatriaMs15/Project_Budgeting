import { X } from "lucide-react";
import { contributeToGoal, deleteGoal } from "@/app/actions/goals";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";
import type { SavingsGoal } from "@/lib/supabase/types";
import { LOCALE } from "@/lib/locale";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const pct =
    goal.target_amount > 0
      ? Math.min(100, (goal.saved_amount / goal.target_amount) * 100)
      : 0;
  const remaining = goal.target_amount - goal.saved_amount;
  const done = remaining <= 0;

  return (
    <div className="flex flex-col gap-2 rounded border border-divider bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-[17px] font-semibold">
            {goal.name}
          </p>
          {goal.target_date && (
            <p className="text-[11px] text-muted-foreground">
              by {formatDate(goal.target_date)}
            </p>
          )}
        </div>
        <form action={deleteGoal}>
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            aria-label={`Delete goal ${goal.name}`}
            className="flex size-7 items-center justify-center rounded text-[color:var(--negative-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--negative-ink)_10%,transparent)]"
          >
            <X className="size-[13px]" strokeWidth={1.75} />
          </button>
        </form>
      </div>

      {/* Both figures are nowrap and the row wraps as a whole, so a large
          target drops to its own line instead of breaking mid-number. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 tabular-nums">
        <span className="whitespace-nowrap font-heading text-[20px] font-semibold">
          {formatIDR(goal.saved_amount)}
        </span>
        <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
          of {formatIDR(goal.target_amount)}
        </span>
      </div>

      <div className="h-[3px] overflow-hidden rounded-sm bg-divider">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? CHART.incomeInk : CHART.accent,
          }}
        />
      </div>

      <p className="text-[13px] text-muted-foreground">
        {done ? "Goal reached." : `${formatIDR(remaining)} to go`}
      </p>

      {!done && (
        <form action={contributeToGoal} className="flex gap-2">
          <input type="hidden" name="id" value={goal.id} />
          <div className="flex-1">
            <MoneyInput name="amount" />
          </div>
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

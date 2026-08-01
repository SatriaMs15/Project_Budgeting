import { contributeToGoal, deleteGoal } from "@/app/actions/goals";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import type { SavingsGoal } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const pct = Math.min(100, (goal.saved_amount / goal.target_amount) * 100);
  const remaining = goal.target_amount - goal.saved_amount;
  const done = remaining <= 0;

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{goal.name}</p>
          {goal.target_date && (
            <p className="text-xs text-muted-foreground">
              by {formatDate(goal.target_date)}
            </p>
          )}
        </div>
        <form action={deleteGoal}>
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            aria-label="Delete goal"
            className="rounded p-1 text-muted-foreground hover:text-red-600"
          >
            ✕
          </button>
        </form>
      </div>

      <div className="flex items-baseline justify-between text-sm tabular-nums">
        <span className="font-semibold">{formatIDR(goal.saved_amount)}</span>
        <span className="text-muted-foreground">
          of {formatIDR(goal.target_amount)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? "#0ca30c" : goal.color,
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {done ? "🎉 Goal reached!" : `${formatIDR(remaining)} to go`}
      </p>

      {!done && (
        <form action={contributeToGoal} className="flex items-end gap-2">
          <input type="hidden" name="id" value={goal.id} />
          <div className="flex-1">
            <MoneyInput name="amount" />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Add money
          </Button>
        </form>
      )}
    </div>
  );
}

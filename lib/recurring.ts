import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/date";
import type { Frequency } from "@/lib/supabase/types";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Next occurrence date after `dateStr` for the given frequency. */
function advance(dateStr: string, frequency: Frequency): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // m is 1-12; new Date(year, monthIndex, day) uses 0-based month index,
  // so `m` (not m-1) lands on the *next* month, same day, with overflow.
  return frequency === "weekly"
    ? iso(new Date(y, m - 1, d + 7))
    : iso(new Date(y, m, d));
}

/**
 * Turn every active recurring rule that is due (next_run_on <= today) into
 * real transactions, catching up any missed periods, then advance the rule.
 * Idempotent: once advanced past today, a rerun does nothing.
 */
export async function materializeDueRecurring() {
  const supabase = await createClient();
  const todayStr = today();

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("active", true)
    .lte("next_run_on", todayStr);

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    const inserts: {
      amount: number;
      kind: typeof rule.kind;
      category_id: string | null;
      note: string | null;
      occurred_on: string;
    }[] = [];

    let next = rule.next_run_on;
    let guard = 0;
    while (next <= todayStr && guard < 400) {
      inserts.push({
        amount: rule.amount,
        kind: rule.kind,
        category_id: rule.category_id,
        note: rule.note,
        occurred_on: next,
      });
      next = advance(next, rule.frequency);
      guard++;
    }

    if (inserts.length > 0) {
      await supabase.from("transactions").insert(inserts);
      await supabase
        .from("recurring_rules")
        .update({ next_run_on: next })
        .eq("id", rule.id);
    }
  }
}

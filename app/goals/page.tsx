import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { AddGoalForm } from "@/components/add-goal-form";
import { GoalCard } from "@/components/goal-card";
import { Card, CardContent } from "@/components/ui/card";

export default async function GoalsPage() {
  const supabase = await createClient();
  const goals = unwrap(
    await supabase
      .from("savings_goals")
      .select("*")
      .order("created_at", { ascending: false }),
    "load savings goals",
  );

  return (
    <div>
      <h1 className="mb-7 font-heading text-[32px] font-semibold">Goals</h1>

      <div className="grid items-start gap-7 lg:grid-cols-[320px_1fr]">
        <Card className="elev-sm">
          <CardContent>
            <p className="kicker mb-2.5">New savings goal</p>
            <AddGoalForm />
          </CardContent>
        </Card>

        {goals.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">
            No goals yet. Set a target on the left — a phone, a trip, a rainy
            day.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { AddGoalForm } from "@/components/add-goal-form";
import { GoalCard } from "@/components/goal-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: goals } = await supabase
    .from("savings_goals")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New savings goal</CardTitle>
        </CardHeader>
        <CardContent>
          <AddGoalForm />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(goals ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No goals yet. Set a target on the left — like saving for a phone or a
            trip.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(goals ?? []).map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

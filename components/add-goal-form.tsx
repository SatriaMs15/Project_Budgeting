"use client";

import { useActionState } from "react";
import { addGoal, type GoalFormState } from "@/app/actions/goals";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: GoalFormState = { ts: 0 };

export function AddGoalForm() {
  const [state, formAction, pending] = useActionState(addGoal, initialState);

  return (
    <form key={state.ts} action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="goal-name">What are you saving for?</Label>
        <Input id="goal-name" name="name" placeholder="e.g. New laptop" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-target">Target amount</Label>
        <MoneyInput id="goal-target" name="target_amount" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-date">Target date (optional)</Label>
        <Input id="goal-date" name="target_date" type="date" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add goal"}
      </Button>
    </form>
  );
}

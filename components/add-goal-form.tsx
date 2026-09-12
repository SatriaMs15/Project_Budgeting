"use client";

import { useActionState } from "react";
import { addGoal, type GoalFormState } from "@/app/actions/goals";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: GoalFormState = { ts: 0 };
const labelClass = "text-xs text-muted-foreground";

export function AddGoalForm() {
  const [state, formAction, pending] = useActionState(addGoal, initialState);

  return (
    <form key={state.ts} action={formAction} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="goal-name" className={labelClass}>
          Name
        </Label>
        <Input
          id="goal-name"
          name="name"
          placeholder="e.g. New phone"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="goal-target" className={labelClass}>
          Target amount
        </Label>
        <MoneyInput id="goal-target" name="target_amount" required />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="goal-date" className={labelClass}>
          Target date (optional)
        </Label>
        <Input id="goal-date" name="target_date" type="date" />
      </div>

      {state.error && (
        <p className="text-sm text-[color:var(--negative-ink)]">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create goal"}
      </Button>
    </form>
  );
}

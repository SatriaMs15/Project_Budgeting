"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GoalFormState = { error?: string; ts: number };

/** Create a savings goal (a "buying target"). */
export async function addGoal(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const target = Number(formData.get("target_amount"));
  const targetDate = String(formData.get("target_date") ?? "");

  if (!name) return { error: "Give the goal a name.", ts: Date.now() };
  if (!Number.isInteger(target) || target <= 0) {
    return { error: "Enter a target amount greater than 0.", ts: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").insert({
    name,
    target_amount: target,
    target_date: targetDate || null,
  });

  if (error) return { error: error.message, ts: Date.now() };

  revalidatePath("/goals");
  return { ts: Date.now() };
}

/** Add money toward a goal (increments saved_amount). */
export async function contributeToGoal(formData: FormData) {
  const id = String(formData.get("id"));
  const amount = Number(formData.get("amount"));
  if (!id || !Number.isInteger(amount) || amount <= 0) return;

  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("savings_goals")
    .select("saved_amount")
    .eq("id", id)
    .single();
  if (!goal) return;

  await supabase
    .from("savings_goals")
    .update({ saved_amount: goal.saved_amount + amount })
    .eq("id", id);

  revalidatePath("/goals");
}

/** Delete a savings goal. */
export async function deleteGoal(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("savings_goals").delete().eq("id", id);
  revalidatePath("/goals");
}

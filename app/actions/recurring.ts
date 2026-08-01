"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Frequency, Kind } from "@/lib/supabase/types";

export type RecurringFormState = { error?: string; ts: number };

/** Create a recurring rule (e.g. rent every month, salary every month). */
export async function addRule(
  _prev: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind")) as Kind;
  const frequency = String(formData.get("frequency")) as Frequency;
  const categoryId = formData.get("category_id");
  const note = String(formData.get("note") ?? "").trim();
  const nextRunOn = String(formData.get("next_run_on") ?? "");

  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Enter an amount greater than 0.", ts: Date.now() };
  }
  if (kind !== "income" && kind !== "expense") {
    return { error: "Pick income or expense.", ts: Date.now() };
  }
  if (frequency !== "weekly" && frequency !== "monthly") {
    return { error: "Pick a frequency.", ts: Date.now() };
  }
  if (!nextRunOn) {
    return { error: "Pick a start date.", ts: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_rules").insert({
    amount,
    kind,
    frequency,
    category_id: categoryId ? String(categoryId) : null,
    note: note || null,
    next_run_on: nextRunOn,
  });

  if (error) return { error: error.message, ts: Date.now() };

  revalidatePath("/recurring");
  return { ts: Date.now() };
}

/** Delete a recurring rule (does not remove already-generated transactions). */
export async function deleteRule(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("recurring_rules").delete().eq("id", id);
  revalidatePath("/recurring");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/supabase/unwrap";
import { isValidDateString } from "@/lib/date";
import type { Kind } from "@/lib/supabase/types";

export type FormState = { error?: string; ts: number };

/** Create an income/expense transaction for the current (anonymous) user. */
export async function addTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind")) as Kind;
  const categoryId = formData.get("category_id");
  const note = String(formData.get("note") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "");

  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Enter an amount greater than 0.", ts: Date.now() };
  }
  if (kind !== "income" && kind !== "expense") {
    return { error: "Pick income or expense.", ts: Date.now() };
  }
  if (occurredOn && !isValidDateString(occurredOn)) {
    return { error: "Enter a valid date.", ts: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    amount,
    kind,
    category_id: categoryId ? String(categoryId) : null,
    note: note || null,
    occurred_on: occurredOn || undefined,
  });

  if (error) return { error: error.message, ts: Date.now() };

  revalidatePath("/transactions");
  revalidatePath("/");
  return { ts: Date.now() };
}

/** Update one of the current user's transactions. */
export async function updateTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id"));
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind")) as Kind;
  const categoryId = formData.get("category_id");
  const note = String(formData.get("note") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "");

  if (!id) return { error: "Missing transaction.", ts: Date.now() };
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Enter an amount greater than 0.", ts: Date.now() };
  }
  if (kind !== "income" && kind !== "expense") {
    return { error: "Pick income or expense.", ts: Date.now() };
  }
  if (occurredOn && !isValidDateString(occurredOn)) {
    return { error: "Enter a valid date.", ts: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      amount,
      kind,
      category_id: categoryId ? String(categoryId) : null,
      note: note || null,
      occurred_on: occurredOn || undefined,
    })
    .eq("id", id);

  if (error) return { error: error.message, ts: Date.now() };

  revalidatePath("/transactions");
  revalidatePath("/");
  return { ts: Date.now() };
}

/** Delete one of the current user's transactions (RLS blocks others'). */
export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  assertOk(
    await supabase.from("transactions").delete().eq("id", id),
    "delete the transaction",
  );
  revalidatePath("/transactions");
  revalidatePath("/");
}

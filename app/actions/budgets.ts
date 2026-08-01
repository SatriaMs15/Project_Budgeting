"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthStart } from "@/lib/date";

/**
 * Set (or clear) the current month's budget limit for a category.
 * A limit of 0/empty removes the budget for that category.
 */
export async function setBudget(formData: FormData) {
  const categoryId = String(formData.get("category_id"));
  const limit = Number(formData.get("limit_amount"));
  const month = monthStart();

  if (!categoryId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (!Number.isFinite(limit) || limit <= 0) {
    await supabase
      .from("budgets")
      .delete()
      .eq("category_id", categoryId)
      .eq("month", month);
  } else {
    await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        month,
        limit_amount: Math.round(limit),
      },
      { onConflict: "user_id,category_id,month" },
    );
  }

  revalidatePath("/budgets");
  revalidatePath("/");
}

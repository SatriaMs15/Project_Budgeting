import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/supabase/types";

/** Categories every new user starts with, so the app is usable immediately. */
const DEFAULT_CATEGORIES: Pick<Category, "name" | "kind" | "color">[] = [
  { name: "Food & Drink", kind: "expense", color: "#ef4444" },
  { name: "Transport", kind: "expense", color: "#f97316" },
  { name: "Shopping", kind: "expense", color: "#eab308" },
  { name: "Bills", kind: "expense", color: "#06b6d4" },
  { name: "Entertainment", kind: "expense", color: "#8b5cf6" },
  { name: "Health", kind: "expense", color: "#ec4899" },
  { name: "Other", kind: "expense", color: "#64748b" },
  { name: "Salary", kind: "income", color: "#22c55e" },
  { name: "Bonus", kind: "income", color: "#14b8a6" },
  { name: "Other Income", kind: "income", color: "#84cc16" },
];

/**
 * Seed the current user's default categories if they have none yet.
 * Safe to call on every page load — it no-ops once categories exist.
 */
export async function ensureDefaultCategories() {
  const supabase = await createClient();

  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 0) return;

  // user_id defaults to auth.uid() in the DB, so we don't set it here.
  await supabase.from("categories").insert(DEFAULT_CATEGORIES);
}

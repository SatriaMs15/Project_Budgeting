import { createClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/supabase/unwrap";
import type { Category } from "@/lib/supabase/types";

/** Categories every new user starts with, so the app is usable immediately. */
const DEFAULT_CATEGORIES: Pick<Category, "name" | "kind" | "color">[] = [
  { name: "Food & Drink", kind: "expense", color: "#a1584a" },
  { name: "Transport", kind: "expense", color: "#6b7a8f" },
  { name: "Shopping", kind: "expense", color: "#8a7a3d" },
  { name: "Bills", kind: "expense", color: "#55716f" },
  { name: "Entertainment", kind: "expense", color: "#6c5b7d" },
  { name: "Health", kind: "expense", color: "#96586a" },
  { name: "Other", kind: "expense", color: "#7d7979" },
  { name: "Salary", kind: "income", color: "#0d7a56" },
  { name: "Bonus", kind: "income", color: "#0d7a56" },
  { name: "Other Income", kind: "income", color: "#0d7a56" },
];

/**
 * Seed the current user's default categories if they have none yet.
 * Safe to call on every page load — it no-ops once categories exist.
 */
export async function ensureDefaultCategories() {
  const supabase = await createClient();

  const countRes = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });
  assertOk(countRes, "count categories");

  if ((countRes.count ?? 0) > 0) return;

  // user_id defaults to auth.uid() in the DB, so we don't set it here.
  assertOk(
    await supabase.from("categories").insert(DEFAULT_CATEGORIES),
    "seed default categories",
  );
}

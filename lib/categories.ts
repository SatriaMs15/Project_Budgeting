import { createClient } from "@/lib/supabase/server";
import { assertOk, DataError } from "@/lib/supabase/unwrap";
import type { Category } from "@/lib/supabase/types";

/**
 * Marker recording that this account has had its defaults. It lives on the auth
 * user rather than in a table because it has to outlive every row the user is
 * able to delete — which is the whole point: it is the only thing that can tell
 * a brand-new account from one the user deliberately emptied.
 */
const SEEDED_FLAG = "categories_seeded";

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
 * Seed the current user's default categories if this is a brand-new account.
 * Safe to call on every page load.
 *
 * "No categories" does not mean "new". Categories can be deleted now, so an
 * established user can empty the list on purpose, and re-seeding would put all
 * ten back behind their back. Three things distinguish the two cases, checked
 * cheapest first — and everything after the count only runs when the list is
 * actually empty, so an ordinary page load still costs one query.
 */
export async function ensureDefaultCategories() {
  const supabase = await createClient();

  const countRes = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });
  assertOk(countRes, "count categories");

  if ((countRes.count ?? 0) > 0) return;

  // An empty list reaches here. A missing session does too: RLS filters rows
  // rather than erroring, so "no user" and "no categories" look identical from
  // the count alone, and the next statement would be the insert that fails with
  // an RLS violation naming the wrong problem.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new DataError("start your session", {
      message: "Supabase returned no signed-in user for this request",
      hint:
        "The anonymous sign-in in proxy.ts did not complete — the server log has the reason. A 429 there means Supabase is rate-limiting anonymous sign-ins (roughly 30/hour per IP on the free tier), which clears on its own.",
    });
  }

  // Already seeded once. The list being empty now is the user's own doing.
  if (user.user_metadata?.[SEEDED_FLAG]) return;

  // Accounts created before the marker existed carry no flag, so fall back to
  // the evidence: any transaction history means this is not a new account.
  const usedRes = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });
  assertOk(usedRes, "count transactions");

  if ((usedRes.count ?? 0) > 0) {
    await markSeeded(supabase);
    return;
  }

  // user_id defaults to auth.uid() in the DB, so we don't set it here.
  assertOk(
    await supabase.from("categories").insert(DEFAULT_CATEGORIES),
    "seed default categories",
  );
  await markSeeded(supabase);
}

/**
 * Record that this account has had its defaults.
 *
 * Best effort on purpose: failing here must not break the page. The worst case
 * is that the next empty-list load re-checks, and the transaction guard still
 * covers every account that has actually been used.
 */
async function markSeeded(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.auth.updateUser({
    data: { [SEEDED_FLAG]: true },
  });
  if (error) {
    console.error(
      `[categories] could not mark the account seeded: ${error.message}`,
    );
  }
}

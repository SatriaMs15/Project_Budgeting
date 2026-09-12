"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertOk, unwrap } from "@/lib/supabase/unwrap";
import { pickCategoryColor } from "@/lib/category-colors";
import type { Kind } from "@/lib/supabase/types";

export type CategoryFormState = { error?: string; ts: number };

/** Long enough for "Entertainment & Subscriptions", short enough to fit a tag. */
const MAX_NAME_LENGTH = 40;

/**
 * A category's name shows up in every picker, tag and chart legend in the app,
 * so a rename or a delete can change any of these screens.
 */
function revalidateCategoryConsumers() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/recurring");
  revalidatePath("/");
}

function fail(error: string): CategoryFormState {
  return { error, ts: Date.now() };
}

/** Names collide when they differ only by case or surrounding space. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Postgres only reports 23505 if a unique index exists; this schema has none on
 * `categories`, so the check above is the real guard and this is the backstop
 * for a constraint added later (or for two submits racing each other).
 */
function isDuplicateError(error: { code?: string | null }): boolean {
  return error.code === "23505";
}

/** Create a category, assigning its ledger mark automatically. */
export async function addCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind")) as Kind;

  if (!name) return fail("Give the category a name.");
  if (name.length > MAX_NAME_LENGTH) {
    return fail(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  }
  if (kind !== "income" && kind !== "expense") {
    return fail("Pick income or expense.");
  }

  const supabase = await createClient();
  const existing = unwrap(
    await supabase.from("categories").select("id, name, kind, color"),
    "load categories",
  );

  // Duplicates are rejected within a kind, not across both. Every picker in the
  // app filters by kind, so an income "Travel" and an expense "Travel" never
  // appear in the same list and are genuinely different things.
  if (existing.some((c) => c.kind === kind && sameName(c.name, name))) {
    return fail(`You already have an ${kind} category called "${name}".`);
  }

  const { error } = await supabase
    .from("categories")
    .insert({ name, kind, color: pickCategoryColor(kind, existing) });

  if (error) {
    if (isDuplicateError(error)) {
      return fail(`You already have an ${kind} category called "${name}".`);
    }
    return fail(error.message);
  }

  revalidateCategoryConsumers();
  return { ts: Date.now() };
}

/**
 * Rename a category. The mark is left alone — it belongs to the row, not the
 * name, so renaming does not reshuffle the colours already on screen.
 */
export async function renameCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) return fail("That category no longer exists.");
  if (!name) return fail("Give the category a name.");
  if (name.length > MAX_NAME_LENGTH) {
    return fail(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const existing = unwrap(
    await supabase.from("categories").select("id, name, kind, color"),
    "load categories",
  );

  const target = existing.find((c) => c.id === id);
  if (!target) return fail("That category no longer exists.");

  const clash = existing.some(
    (c) => c.id !== id && c.kind === target.kind && sameName(c.name, name),
  );
  if (clash) {
    return fail(
      `You already have an ${target.kind} category called "${name}".`,
    );
  }

  const { error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id);

  if (error) {
    if (isDuplicateError(error)) {
      return fail(
        `You already have an ${target.kind} category called "${name}".`,
      );
    }
    return fail(error.message);
  }

  revalidateCategoryConsumers();
  return { ts: Date.now() };
}

/**
 * Delete a category.
 *
 * The database decides what happens to everything pointing at it, and the two
 * rules differ (supabase/migrations/0001_init.sql):
 *   - transactions.category_id and recurring_rules.category_id are ON DELETE
 *     SET NULL, so that history survives and simply reads as Uncategorized;
 *   - budgets.category_id is ON DELETE CASCADE, so every month's limit for this
 *     category is destroyed outright.
 * The confirmation dialog spells the cascade out before the user gets here.
 */
export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  assertOk(
    await supabase.from("categories").delete().eq("id", id),
    "delete the category",
  );

  revalidateCategoryConsumers();
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AccountState = { error?: string; notice?: string; ts: number };

const MIN_PASSWORD = 8;

function fail(error: string): AccountState {
  return { error, ts: Date.now() };
}

/** Where Supabase should send the confirmation link back to. */
async function confirmUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/auth/confirm`;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function invalid(email: string, password: string): string | null {
  if (!email || !email.includes("@")) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) {
    return `Use a password of at least ${MIN_PASSWORD} characters.`;
  }
  return null;
}

/**
 * Attach an email and password to the anonymous account this browser is
 * already using, so the same ledger can be opened on another device.
 *
 * The account keeps its user id, which is the whole point: every transaction,
 * budget and goal is tied to that id, so linking an identity carries the
 * existing data with it rather than starting something new alongside it.
 *
 * The password is set first, and deliberately: it needs no email round trip, so
 * once the address is confirmed the other devices can sign in immediately. The
 * alternative — confirm, then come back and set a password — spends a second
 * email, and Supabase's built-in sender allows only two an hour.
 */
export async function claimAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const { email, password } = readCredentials(formData);
  const problem = invalid(email, password);
  if (problem) return fail(problem);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No session to save. Reload the page and try again.");
  if (user.email) {
    return fail(`This ledger is already saved to ${user.email}.`);
  }

  const passwordSet = await supabase.auth.updateUser({ password });
  if (passwordSet.error) return fail(passwordSet.error.message);

  const emailSet = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: await confirmUrl() },
  );
  if (emailSet.error) {
    // The most common failure by far, and the one worth naming: that address
    // already belongs to another ledger.
    if (/already/i.test(emailSet.error.message)) {
      return fail(
        `${email} is already used by another ledger. Sign in to that one instead, or use a different address.`,
      );
    }
    return fail(emailSet.error.message);
  }

  revalidatePath("/account");
  return {
    notice: `Check ${email} for a confirmation link. Your ledger is unchanged either way — confirming is what lets you open it on another device.`,
    ts: Date.now(),
  };
}

/**
 * Sign in to a ledger that was already saved to an email.
 *
 * This REPLACES whatever anonymous account this browser was using. That
 * account's rows are not deleted, but nothing points at them any more, so the
 * form warns before this runs.
 */
export async function signInToAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) {
      return fail(
        "That email hasn't been confirmed yet. Open the link Supabase sent you first.",
      );
    }
    return fail("That email and password don't match a saved ledger.");
  }

  revalidatePath("/", "layout");
  return { notice: "Signed in.", ts: Date.now() };
}

/**
 * Sign out. The next page load starts a fresh anonymous ledger, which is the
 * same state a new visitor sees — the saved one is reachable again by signing
 * back in.
 */
export async function signOutOfAccount(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

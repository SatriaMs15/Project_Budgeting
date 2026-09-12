import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes the email confirmation Supabase sends when a ledger is saved.
 *
 * The link carries `token_hash` and `type`; exchanging them establishes the
 * session. It uses the project's SSR client rather than a plain supabase-js one
 * on purpose — only the SSR client writes the session back to cookies, and a
 * session that never reaches the cookie jar means the user confirms their email
 * and still looks signed out.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const failed = (reason: string) =>
    NextResponse.redirect(`${origin}/account?confirm=${reason}`);

  if (!tokenHash || !type) return failed("missing");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return failed("invalid");

  return NextResponse.redirect(`${origin}/account?confirm=ok`);
}

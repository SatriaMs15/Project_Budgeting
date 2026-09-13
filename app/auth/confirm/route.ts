import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes the email confirmation Supabase sends when a ledger is saved.
 *
 * Supabase can arrive here in three different shapes, and an earlier version
 * handled only the first, so a confirmation that had genuinely succeeded was
 * reported to the user as a broken link:
 *
 *   1. `token_hash` + `type` — only when the email template is customised to
 *      use {{ .TokenHash }}. Exchanged here via verifyOtp.
 *   2. `code` — the PKCE flow, exchanged for a session.
 *   3. Nothing at all — the DEFAULT template. {{ .ConfirmationURL }} points at
 *      Supabase's own verify endpoint, which validates the token itself and
 *      then redirects here, carrying the session in the URL fragment. A
 *      fragment never reaches the server, so no parameter arrives.
 *
 * Case 3 is why this ends by asking the session what actually happened rather
 * than judging by the parameters: by then the address is already confirmed, and
 * the only honest answer comes from the user record.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const done = (result: string) =>
    NextResponse.redirect(`${origin}/account?confirm=${result}`);

  // Supabase reports its own failures as query parameters.
  if (searchParams.get("error") || searchParams.get("error_description")) {
    return done("invalid");
  }

  const supabase = await createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    return done(error ? "invalid" : "ok");
  }

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return done(error ? "invalid" : "ok");
  }

  // No parameters: Supabase already verified server-side. Report what is true.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return done(user?.email ? "ok" : "missing");
}

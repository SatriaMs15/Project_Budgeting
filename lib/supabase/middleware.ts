import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request, and — the core of our
 * "no login screen" flow — silently signs the visitor in anonymously the
 * first time they arrive. Each device therefore gets its own private user,
 * whose id (auth.uid()) is used by Row Level Security to isolate data.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      // Swallowing this was expensive. With no session, every RLS-protected
      // write fails, and the visible symptom is "new row violates row-level
      // security policy" on whatever table the page touched first — which reads
      // like a schema or permissions bug rather than a sign-in that never
      // happened. Log the real cause; lib/categories.ts turns the downstream
      // failure into a message that points back here.
      const status = error.status ?? "no status";
      const rateLimited = error.status === 429;
      console.error(
        `[auth] anonymous sign-in failed (${status}): ${error.message}` +
          (rateLimited
            ? " — Supabase rate-limits anonymous sign-ins (roughly 30/hour per IP on the free tier). It clears on its own; requests until then have no user attached."
            : ""),
      );
    }
  }

  return supabaseResponse;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Is this request a browser asking for a page?
 *
 * Every cookieless request that reaches the sign-in below creates a REAL,
 * durable row in auth.users. On a public URL that adds up: asset probes, RSC
 * payload fetches and 404 scans would each mint an account, burning the
 * anonymous sign-in rate limit and counting toward Supabase's monthly active
 * user allowance for nothing.
 *
 * A page navigation always asks for text/html. RSC and prefetch requests ask
 * for text/x-component, and those come from a browser that already holds a
 * session, so this never costs a real visitor anything — it only skips the
 * requests that were never going to render a page.
 *
 * It does NOT stop a crawler that ignores app/robots.ts, since one of those
 * asks for HTML like anyone else. Matching on user agent was considered and
 * rejected: a false positive silently denies a real person a session, which is
 * a worse failure than an unwanted account.
 */
function wantsPage(request: NextRequest): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

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

  if (!user && wantsPage(request)) {
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

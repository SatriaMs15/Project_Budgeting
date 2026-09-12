import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import {
  ClaimForm,
  SignInForm,
  SignOutButton,
} from "@/components/account-panel";
import { Card, CardContent } from "@/components/ui/card";

const CONFIRM_MESSAGES: Record<string, string> = {
  ok: "Email confirmed. This ledger can now be opened on your other devices by signing in.",
  invalid: "That confirmation link has expired or was already used. Save the ledger again to get a new one.",
  missing: "That link was incomplete. Open the most recent email and try again.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { confirm } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Whether this browser's ledger holds anything, so signing in can warn about
  // what swapping away from it would put out of reach.
  const txns = unwrap(
    await supabase.from("transactions").select("id").limit(1),
    "check this ledger",
  );
  const hasLocalData = txns.length > 0;
  const saved = Boolean(user?.email);

  return (
    <div>
      <h1 className="mb-1 font-heading text-[32px] font-semibold">Account</h1>
      <p className="mb-7 text-sm text-muted-foreground">
        {saved
          ? "This ledger is saved, and opens on any device you sign in from."
          : "This ledger lives in this browser only"}
      </p>

      {confirm && CONFIRM_MESSAGES[confirm] && (
        <Card className="elev-sm mb-7">
          <CardContent>
            <p
              className={
                confirm === "ok"
                  ? "text-sm text-[color:var(--accent-700)]"
                  : "text-sm text-[color:var(--negative-ink)]"
              }
            >
              {CONFIRM_MESSAGES[confirm]}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[360px_1fr]">
        <Card className="elev-sm">
          <CardContent>
            {saved ? (
              <>
                <p className="kicker mb-2.5">Saved to</p>
                <p className="mb-4 text-[15px]">{user!.email}</p>
                <p className="mb-4 text-[13px] text-muted-foreground">
                  Signing out leaves a fresh, empty ledger in this browser. This
                  one stays put and comes back when you sign in again.
                </p>
                <SignOutButton />
              </>
            ) : (
              <>
                <p className="kicker mb-2.5">Save this ledger</p>
                <p className="mb-4 text-[13px] text-muted-foreground">
                  Everything you have entered here stays exactly as it is. An
                  email and password simply give it a way back, so the same
                  ledger opens on your phone, laptop and desktop instead of each
                  keeping its own.
                </p>
                <ClaimForm />
              </>
            )}
          </CardContent>
        </Card>

        {!saved && (
          <Card className="elev-sm">
            <CardContent>
              <p className="kicker mb-2.5">Already saved one?</p>
              <p className="mb-4 text-[13px] text-muted-foreground">
                Sign in to open it here.
              </p>
              <SignInForm hasLocalData={hasLocalData} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

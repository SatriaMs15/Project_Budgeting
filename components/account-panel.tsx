"use client";

import { useActionState, useState } from "react";
import {
  claimAccount,
  setAccountPassword,
  signInToAccount,
  signOutOfAccount,
  type AccountState,
} from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AccountState = { ts: 0 };
const labelClass = "text-xs text-muted-foreground";

function Message({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p className="text-sm text-[color:var(--negative-ink)]">{state.error}</p>
    );
  }
  if (state.notice) {
    return <p className="text-sm text-[color:var(--accent-700)]">{state.notice}</p>;
  }
  return null;
}

function Credentials({ idPrefix, autoComplete }: { idPrefix: string; autoComplete: string }) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-email`} className={labelClass}>
          Email
        </Label>
        <Input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-password`} className={labelClass}>
          Password
        </Label>
        <Input
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete={autoComplete}
          required
        />
      </div>
    </>
  );
}

/**
 * Attach an email to the anonymous ledger this browser already holds.
 *
 * Email only: Supabase will not set a password on an anonymous user until it
 * has a confirmed address, so the password is a separate step afterwards.
 */
export function ClaimForm() {
  const [state, action, pending] = useActionState(claimAccount, initial);
  return (
    <form action={action} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="claim-email" className={labelClass}>
          Email
        </Label>
        <Input
          id="claim-email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <Message state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Save this ledger"}
      </Button>
    </form>
  );
}

/** Set the password the other devices will sign in with. */
export function PasswordForm() {
  const [state, action, pending] = useActionState(setAccountPassword, initial);
  return (
    <form action={action} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="set-password" className={labelClass}>
          Password
        </Label>
        <Input
          id="set-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <Message state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}

/**
 * Sign in to a ledger saved earlier. Signing in replaces this browser's
 * anonymous ledger, so the confirmation is explicit rather than a surprise.
 */
export function SignInForm({ hasLocalData }: { hasLocalData: boolean }) {
  const [state, action, pending] = useActionState(signInToAccount, initial);
  const [confirmed, setConfirmed] = useState(false);
  const blocked = hasLocalData && !confirmed;

  return (
    <form action={action} className="grid gap-3.5">
      <Credentials idPrefix="signin" autoComplete="current-password" />

      {hasLocalData && (
        <label className="flex items-start gap-2.5 rounded border border-[color-mix(in_srgb,var(--negative-ink)_45%,transparent)] bg-[color-mix(in_srgb,var(--negative-ink)_7%,transparent)] p-3 text-[13px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-[color:var(--negative-ink)]">
            This browser already has entries of its own. Signing in swaps to the
            saved ledger and they will no longer be reachable here.
          </span>
        </label>
      )}

      <Message state={state} />
      <Button type="submit" disabled={pending || blocked} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutOfAccount}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}

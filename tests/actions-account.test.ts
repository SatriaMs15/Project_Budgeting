import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createHarness,
  makeClient,
  form,
  type HarnessState,
} from "./supabase-harness";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", "buku.example"], ["x-forwarded-proto", "https"]]),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));

const { claimAccount, setAccountPassword, signInToAccount, signOutOfAccount } =
  await import("@/app/actions/account");

const prev = { ts: 0 };
const good = { email: "me@example.com", password: "correct-horse" };

beforeEach(() => {
  h.state = createHarness();
});

const updates = () => h.state.authUpdates as Record<string, unknown>[];

describe("claimAccount — input", () => {
  it.each([
    ["missing", undefined],
    ["not an address", "nope"],
    ["empty", ""],
  ])("rejects a %s email", async (_label, email) => {
    const r = await claimAccount(prev, form({ email }));
    expect(r.error).toBe("Enter a valid email address.");
    expect(updates()).toHaveLength(0);
  });

  it("lowercases and trims the address", async () => {
    await claimAccount(prev, form({ email: "  ME@Example.COM  " }));
    expect(updates()[0]).toMatchObject({ email: "me@example.com" });
  });
});

describe("claimAccount — what it sends", () => {
  it("asks for the email ONLY, never a password", async () => {
    // Supabase refuses to set a password on an anonymous user that has no
    // email yet: "Updating password of an anonymous user without an email or
    // phone is not allowed". Sending one here fails the whole claim.
    await claimAccount(prev, form({ email: good.email }));
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).not.toHaveProperty("password");
    expect(updates()[0]).toHaveProperty("email");
  });

  it("tells the user to go and check that address", async () => {
    const r = await claimAccount(prev, form({ email: good.email }));
    expect(r.error).toBeUndefined();
    expect(r.notice).toContain("me@example.com");
  });

  it("reassures that the ledger is untouched either way", async () => {
    const r = await claimAccount(prev, form({ email: good.email }));
    expect(r.notice).toMatch(/unchanged/i);
  });
});

describe("setAccountPassword", () => {
  it("sets the password once the address is confirmed", async () => {
    h.state.user = { id: "u1", email: "me@example.com" };
    const r = await setAccountPassword(prev, form({ password: "adminadmin" }));
    expect(r.error).toBeUndefined();
    expect(updates()[0]).toMatchObject({ password: "adminadmin" });
  });

  it("refuses before there is a confirmed address", async () => {
    // This is the order Supabase actually enforces; getting it wrong is what
    // the first version of this flow did.
    h.state.user = { id: "u1", email: null };
    const r = await setAccountPassword(prev, form({ password: "adminadmin" }));
    expect(r.error).toMatch(/Confirm your email address first/);
    expect(updates()).toHaveLength(0);
  });

  it("rejects a password under 8 characters", async () => {
    h.state.user = { id: "u1", email: "me@example.com" };
    const r = await setAccountPassword(prev, form({ password: "short" }));
    expect(r.error).toMatch(/at least 8 characters/);
    expect(updates()).toHaveLength(0);
  });

  it("sends no email, so the flow still costs only one", async () => {
    h.state.user = { id: "u1", email: "me@example.com" };
    await setAccountPassword(prev, form({ password: "adminadmin" }));
    expect(updates()[0]).not.toHaveProperty("email");
  });
});

describe("claimAccount — refusals", () => {
  it("refuses when there is no session to save", async () => {
    h.state.user = null;
    const r = await claimAccount(prev, form({ email: good.email }));
    expect(r.error).toMatch(/No session to save/);
    expect(updates()).toHaveLength(0);
  });

  it("refuses when this ledger is already saved", async () => {
    h.state.user = { id: "u1", email: "taken@example.com" };
    const r = await claimAccount(prev, form({ email: good.email }));
    expect(r.error).toContain("taken@example.com");
    expect(updates()).toHaveLength(0);
  });

  it("names the real problem when the address belongs to another ledger", async () => {
    h.state.errors["auth.updateUser.email"] = {
      message: "A user with this email address has already been registered",
    };
    const r = await claimAccount(prev, form({ email: good.email }));
    expect(r.error).toMatch(/already used by another ledger/i);
    expect(r.error).toMatch(/Sign in to that one instead/i);
  });
});

describe("signInToAccount", () => {
  it("signs in with what the user typed", async () => {
    const r = await signInToAccount(prev, form(good));
    expect(r.error).toBeUndefined();
    expect(h.state.signIns[0]).toEqual(good);
  });

  it("requires both fields", async () => {
    expect((await signInToAccount(prev, form({ email: "", password: "x" }))).error)
      .toMatch(/Enter your email and password/);
    expect((await signInToAccount(prev, form({ email: "a@b.c", password: "" }))).error)
      .toMatch(/Enter your email and password/);
    expect(h.state.signIns).toHaveLength(0);
  });

  it("does not leak whether the address exists", async () => {
    // A distinct "no such user" message would let anyone test addresses.
    h.state.errors["auth.signInWithPassword"] = { message: "Invalid login credentials" };
    const r = await signInToAccount(prev, form(good));
    expect(r.error).toBe("That email and password don't match a saved ledger.");
  });

  it("explains an unconfirmed address rather than blaming the password", async () => {
    h.state.errors["auth.signInWithPassword"] = { message: "Email not confirmed" };
    const r = await signInToAccount(prev, form(good));
    expect(r.error).toMatch(/hasn't been confirmed/i);
  });
});

describe("signOutOfAccount", () => {
  it("ends the session", async () => {
    await signOutOfAccount();
    expect(h.state.signedOut).toBe(true);
    expect(h.state.user).toBeNull();
  });
});

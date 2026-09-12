import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers lib/supabase/middleware.ts — the anonymous sign-in that every request
 * depends on. Its failure used to be discarded, which is what made a
 * rate-limited sign-in look like a row-level-security bug three screens away.
 */

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  signInError: null as { message: string; status?: number } | null,
  signInCalls: 0,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
      signInAnonymously: async () => {
        state.signInCalls += 1;
        return {
          data: { user: null, session: null },
          error: state.signInError,
        };
      },
    },
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: { next: (init: unknown) => ({ __response: true, init }) },
}));

const { updateSession } = await import("@/lib/supabase/middleware");

/** A browser asking for a page, unless told otherwise. */
const request = (accept = "text/html,application/xhtml+xml") =>
  ({
    cookies: { getAll: () => [], set: () => {} },
    headers: { get: (k: string) => (k === "accept" ? accept : null) },
  }) as never;

let errors: string[];

beforeEach(() => {
  state.user = null;
  state.signInError = null;
  state.signInCalls = 0;
  errors = [];
  vi.spyOn(console, "error").mockImplementation((m: unknown) => {
    errors.push(String(m));
  });
});

describe("anonymous session bootstrap", () => {
  it("signs in a visitor who has no user yet", async () => {
    await updateSession(request());
    expect(state.signInCalls).toBe(1);
  });

  it("does not sign in again when a user is already attached", async () => {
    state.user = { id: "u1" };
    await updateSession(request());
    expect(state.signInCalls).toBe(0);
  });

  it("stays quiet when the sign-in succeeds", async () => {
    await updateSession(request());
    expect(errors).toHaveLength(0);
  });
});

describe("only page requests are allowed to mint an account", () => {
  // Every cookieless request that reaches signInAnonymously creates a real row
  // in auth.users, which burns the rate limit and counts toward the free tier's
  // monthly active users.

  it("signs in for a normal page navigation", async () => {
    await updateSession(request());
    expect(state.signInCalls).toBe(1);
  });

  it("does not sign in for an RSC or prefetch request", async () => {
    await updateSession(request("text/x-component"));
    expect(state.signInCalls).toBe(0);
  });

  it("does not sign in for an asset or API probe", async () => {
    await updateSession(request("*/*"));
    expect(state.signInCalls).toBe(0);
    await updateSession(request("application/json"));
    expect(state.signInCalls).toBe(0);
  });

  it("does not sign in when the request states no preference at all", async () => {
    await updateSession(request(""));
    expect(state.signInCalls).toBe(0);
  });

  it("still returns a response for a request it skipped", async () => {
    const res = await updateSession(request("*/*"));
    expect(res).toBeTruthy();
  });

  it("never signs in twice for someone who already has a session", async () => {
    state.user = { id: "u1" };
    await updateSession(request());
    expect(state.signInCalls).toBe(0);
  });
});

describe("when the anonymous sign-in fails", () => {
  it("reports it instead of discarding it", async () => {
    state.signInError = { message: "Request rate limit reached", status: 429 };
    await updateSession(request());
    expect(errors.join(" ")).toMatch(/anonymous sign-in failed/i);
  });

  it("includes the status and the provider's own message", async () => {
    state.signInError = { message: "Request rate limit reached", status: 429 };
    await updateSession(request());
    expect(errors.join(" ")).toContain("429");
    expect(errors.join(" ")).toContain("Request rate limit reached");
  });

  it("explains a 429, which is the failure that actually happens", async () => {
    state.signInError = { message: "Request rate limit reached", status: 429 };
    await updateSession(request());
    expect(errors.join(" ")).toMatch(/rate-limits anonymous sign-ins/i);
    expect(errors.join(" ")).toMatch(/clears on its own/i);
  });

  it("does not claim a rate limit for some other failure", async () => {
    state.signInError = { message: "Anonymous sign-ins are disabled", status: 422 };
    await updateSession(request());
    expect(errors.join(" ")).toContain("422");
    expect(errors.join(" ")).not.toMatch(/rate-limits/i);
  });

  it("copes with an error carrying no status", async () => {
    state.signInError = { message: "network down" };
    await updateSession(request());
    expect(errors.join(" ")).toContain("no status");
  });

  it("still returns a response, so the request is not left hanging", async () => {
    state.signInError = { message: "boom", status: 500 };
    const res = await updateSession(request());
    expect(res).toBeTruthy();
  });
});

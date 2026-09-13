import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createHarness,
  makeClient,
  type HarnessState,
} from "./supabase-harness";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));
vi.mock("next/server", () => ({
  NextResponse: { redirect: (url: string) => ({ url: String(url) }) },
}));

const { GET } = await import("@/app/auth/confirm/route");

const call = async (query: string) =>
  (await GET(
    { url: `https://buku.example/auth/confirm${query}` } as never,
  )) as unknown as { url: string };

beforeEach(() => {
  h.state = createHarness();
  h.state.user = { id: "u1", email: "me@example.com" };
});

const took = (method: string) =>
  h.state.authCalls.some((c) => c.method === method);

describe("confirmation links Supabase actually sends", () => {
  it("exchanges token_hash when the template is customised", async () => {
    const r = await call("?token_hash=abc&type=email_change");
    expect(took("verifyOtp")).toBe(true);
    expect(r.url).toContain("confirm=ok");
  });

  it("exchanges a PKCE code", async () => {
    const r = await call("?code=xyz");
    expect(took("exchangeCodeForSession")).toBe(true);
    expect(r.url).toContain("confirm=ok");
  });

  it("accepts the DEFAULT template, which sends no parameters at all", async () => {
    // Regression: {{ .ConfirmationURL }} verifies at Supabase and redirects
    // here with the session in the URL fragment, which never reaches the
    // server. Judging by parameters alone called a successful confirmation a
    // broken link.
    const r = await call("");
    expect(r.url).toContain("confirm=ok");
  });

  it("does not guess — it asks the session what happened", async () => {
    h.state.user = { id: "u1", email: null };
    const r = await call("");
    expect(r.url).toContain("confirm=missing");
  });
});

describe("confirmation failures", () => {
  it("reports Supabase's own error parameter", async () => {
    const r = await call("?error=access_denied&error_description=expired");
    expect(r.url).toContain("confirm=invalid");
    expect(h.state.authCalls).toHaveLength(0);
  });

  it("reports a rejected token_hash", async () => {
    h.state.errors["auth.verifyOtp"] = { message: "Token has expired" };
    const r = await call("?token_hash=stale&type=email_change");
    expect(r.url).toContain("confirm=invalid");
  });

  it("reports a rejected code", async () => {
    h.state.errors["auth.exchangeCodeForSession"] = { message: "bad code" };
    const r = await call("?code=stale");
    expect(r.url).toContain("confirm=invalid");
  });

  it("always lands the user back on the account page", async () => {
    for (const q of ["", "?code=x", "?token_hash=a&type=email_change", "?error=nope"]) {
      expect((await call(q)).url).toContain("/account?confirm=");
    }
  });
});

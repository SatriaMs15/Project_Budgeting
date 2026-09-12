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

const { ensureDefaultCategories } = await import("@/lib/categories");

beforeEach(() => {
  h.state = createHarness();
});

/** The harness derives `count` from the rows a table is configured with. */
function rows(table: string, n: number) {
  h.state.data[table] = Array.from({ length: n }, (_, i) => ({ id: `${i}` }));
}

function seedInsert() {
  return h.state.calls.find((c) => c.table === "categories" && c.op === "insert")
    ?.payload as { name: string; kind: string; color: string }[] | undefined;
}

const markedSeeded = () =>
  h.state.authUpdates.some((u) => u.data?.categories_seeded === true);

describe("ensureDefaultCategories on a new account", () => {
  it("seeds the defaults when there are no categories and no history", async () => {
    await ensureDefaultCategories();
    expect(seedInsert()).toHaveLength(10);
  });

  it("seeds both kinds, so every picker has something in it", async () => {
    await ensureDefaultCategories();
    const kinds = new Set(seedInsert()!.map((c) => c.kind));
    expect(kinds).toEqual(new Set(["expense", "income"]));
  });

  it("gives every seeded category a colour", async () => {
    await ensureDefaultCategories();
    for (const c of seedInsert()!) expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("records that the account has been seeded", async () => {
    await ensureDefaultCategories();
    expect(markedSeeded()).toBe(true);
  });
});

describe("ensureDefaultCategories does not undo a deliberate delete", () => {
  it("does NOT re-seed an account already marked, even with an empty list", async () => {
    // The gap the marker closes: a user who deletes all ten before recording a
    // single transaction used to get them all back on the next page load.
    h.state.user!.user_metadata = { categories_seeded: true };
    rows("categories", 0);
    rows("transactions", 0);

    await ensureDefaultCategories();
    expect(seedInsert()).toBeUndefined();
  });

  it("does not re-seed an account with history but no marker", async () => {
    // Accounts created before the marker existed fall back to the evidence.
    rows("categories", 0);
    rows("transactions", 42);

    await ensureDefaultCategories();
    expect(seedInsert()).toBeUndefined();
  });

  it("back-fills the marker onto such an account, so it is checked once", async () => {
    rows("categories", 0);
    rows("transactions", 42);

    await ensureDefaultCategories();
    expect(markedSeeded()).toBe(true);
  });

  it("does nothing at all when categories already exist", async () => {
    rows("categories", 10);
    await ensureDefaultCategories();
    expect(seedInsert()).toBeUndefined();
  });
});

describe("ensureDefaultCategories cost", () => {
  it("costs one query and no auth round trip on the common path", async () => {
    // This runs on five pages on every load, so the populated case must stay
    // as cheap as it was before the marker was introduced.
    rows("categories", 10);
    await ensureDefaultCategories();

    expect(h.state.calls).toHaveLength(1);
    expect(h.state.authReads).toBe(0);
    expect(h.state.authUpdates).toHaveLength(0);
  });

  it("only reaches for the user once the list is actually empty", async () => {
    rows("categories", 0);
    await ensureDefaultCategories();
    expect(h.state.authReads).toBeGreaterThan(0);
  });
});

describe("ensureDefaultCategories without a session", () => {
  it("names the sign-in as the problem, not row level security", async () => {
    // The old behaviour let the insert fail with "new row violates row level
    // security policy", which reads as a schema or permissions bug rather than
    // a sign-in that never happened.
    h.state.user = null;
    await expect(ensureDefaultCategories()).rejects.toThrow(
      /Could not start your session/,
    );
  });

  it("points at the anonymous sign-in and the rate limit", async () => {
    h.state.user = null;
    await expect(ensureDefaultCategories()).rejects.toThrow(
      /anonymous sign-in|rate-limit/i,
    );
  });

  it("does not attempt the seed with no user attached", async () => {
    h.state.user = null;
    await ensureDefaultCategories().catch(() => {});
    expect(seedInsert()).toBeUndefined();
  });
});

describe("ensureDefaultCategories failures", () => {
  it("throws rather than seeding blind when the count fails", async () => {
    h.state.errors["categories"] = { message: "boom", code: "PGRST205" };
    await expect(ensureDefaultCategories()).rejects.toThrow(
      /Could not count categories/,
    );
  });

  it("throws rather than seeding blind when the history check fails", async () => {
    h.state.errors["transactions"] = { message: "boom", code: "42501" };
    await expect(ensureDefaultCategories()).rejects.toThrow(
      /Could not count transactions/,
    );
    expect(seedInsert()).toBeUndefined();
  });

  it("surfaces a failed seed insert", async () => {
    h.state.errors["categories.insert"] = { message: "denied" };
    await expect(ensureDefaultCategories()).rejects.toThrow(
      /Could not seed default categories/,
    );
  });

  it("still seeds when the marker cannot be written", async () => {
    // Marking is best effort: a failure there must not cost the user their
    // starting categories.
    h.state.errors["auth.updateUser"] = { message: "nope" };
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});

    await ensureDefaultCategories();

    expect(seedInsert()).toHaveLength(10);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/could not mark the account seeded/i),
    );
    warn.mockRestore();
  });
});

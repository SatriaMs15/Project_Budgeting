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
  return h.state.calls.find(
    (c) => c.table === "categories" && c.op === "insert",
  )?.payload as { name: string; kind: string; color: string }[] | undefined;
}

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
});

describe("ensureDefaultCategories on an established account", () => {
  it("does nothing when categories already exist", async () => {
    rows("categories", 10);
    await ensureDefaultCategories();
    expect(seedInsert()).toBeUndefined();
  });

  it("does NOT resurrect categories the user deleted on purpose", async () => {
    // Now that categories can be deleted, an empty list is a deliberate state.
    // Transaction history is what tells a cleared account from a brand-new one.
    rows("categories", 0);
    rows("transactions", 42);
    await ensureDefaultCategories();
    expect(seedInsert()).toBeUndefined();
  });

  it("still seeds an account that is empty in every respect", async () => {
    rows("categories", 0);
    rows("transactions", 0);
    await ensureDefaultCategories();
    expect(seedInsert()).toHaveLength(10);
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createHarness,
  makeClient,
  form,
  type HarnessState,
} from "./supabase-harness";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));

const { addCategory, renameCategory, deleteCategory } =
  await import("@/app/actions/categories");

const prev = { ts: 0 };

/** The seeded defaults, as the action sees them coming back from Postgres. */
const seeded = [
  { id: "c-food", name: "Food & Drink", kind: "expense", color: "#a1584a" },
  { id: "c-transport", name: "Transport", kind: "expense", color: "#667488" },
  { id: "c-salary", name: "Salary", kind: "income", color: "#0d7a56" },
];

beforeEach(() => {
  h.state = createHarness();
  h.state.data["categories"] = seeded;
});

/** The insert the action would have sent, or undefined if it never got there. */
function inserted() {
  return h.state.calls.find((c) => c.op === "insert")?.payload as
    { name: string; kind: string; color: string } | undefined;
}

describe("addCategory — name input", () => {
  it("inserts a trimmed name with the requested kind", async () => {
    const r = await addCategory(
      prev,
      form({ name: "  Groceries  ", kind: "expense" }),
    );
    expect(r.error).toBeUndefined();
    expect(inserted()).toMatchObject({ name: "Groceries", kind: "expense" });
  });

  it("rejects a blank name", async () => {
    const r = await addCategory(prev, form({ name: "", kind: "expense" }));
    expect(r.error).toBe("Give the category a name.");
    expect(inserted()).toBeUndefined();
  });

  it("rejects a whitespace-only name", async () => {
    const r = await addCategory(prev, form({ name: "   ", kind: "expense" }));
    expect(r.error).toBe("Give the category a name.");
  });

  it("rejects a name past the tag's length budget", async () => {
    const r = await addCategory(
      prev,
      form({ name: "x".repeat(41), kind: "expense" }),
    );
    expect(r.error).toBe("Keep the name under 40 characters.");
    expect(inserted()).toBeUndefined();
  });

  it("accepts a name exactly at the limit", async () => {
    const r = await addCategory(
      prev,
      form({ name: "x".repeat(40), kind: "expense" }),
    );
    expect(r.error).toBeUndefined();
  });
});

describe("addCategory — kind input", () => {
  it.each([
    ["missing", undefined],
    ["nonsense", "sideways"],
    ["empty", ""],
  ])("rejects a %s kind", async (_label, kind) => {
    const r = await addCategory(prev, form({ name: "Groceries", kind }));
    expect(r.error).toBe("Pick income or expense.");
    expect(inserted()).toBeUndefined();
  });
});

describe("addCategory — duplicate names", () => {
  it("rejects an exact duplicate within the same kind", async () => {
    const r = await addCategory(
      prev,
      form({ name: "Food & Drink", kind: "expense" }),
    );
    expect(r.error).toBe(
      'You already have an expense category called "Food & Drink".',
    );
    expect(inserted()).toBeUndefined();
  });

  it.each([
    ["different case", "food & drink"],
    ["shouted", "FOOD & DRINK"],
    ["padded", "  Food & Drink  "],
  ])("rejects a %s duplicate", async (_label, name) => {
    const r = await addCategory(prev, form({ name, kind: "expense" }));
    expect(r.error).toMatch(/already have an expense category/);
    expect(inserted()).toBeUndefined();
  });

  it("allows the same name under the other kind", async () => {
    // Every picker in the app filters by kind, so these never collide on screen.
    const r = await addCategory(
      prev,
      form({ name: "Food & Drink", kind: "income" }),
    );
    expect(r.error).toBeUndefined();
    expect(inserted()).toMatchObject({ name: "Food & Drink", kind: "income" });
  });

  it("reports a unique-constraint violation in the same words", async () => {
    // Backstop for a unique index added later, or two submits racing.
    h.state.errors["categories.insert"] = { message: "dupe", code: "23505" };
    const r = await addCategory(prev, form({ name: "Fuel", kind: "expense" }));
    expect(r.error).toBe('You already have an expense category called "Fuel".');
  });
});

describe("addCategory — colour assignment", () => {
  it("never asks the user for a colour, and always stores one", async () => {
    await addCategory(prev, form({ name: "Fuel", kind: "expense" }));
    expect(inserted()?.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("gives a new expense category a mark no sibling is using yet", async () => {
    await addCategory(prev, form({ name: "Fuel", kind: "expense" }));
    const used = seeded.filter((c) => c.kind === "expense").map((c) => c.color);
    expect(used).not.toContain(inserted()?.color);
  });

  it("puts every income category on the shared income ink", async () => {
    await addCategory(prev, form({ name: "Freelance", kind: "income" }));
    expect(inserted()?.color).toBe("#0d7a56");
  });
});

describe("addCategory — failures", () => {
  it("surfaces an insert error rather than pretending it worked", async () => {
    h.state.errors["categories.insert"] = { message: "denied" };
    const r = await addCategory(prev, form({ name: "Fuel", kind: "expense" }));
    expect(r.error).toBe("denied");
  });

  it("throws when the existing categories cannot be read", async () => {
    // Reading is how duplicates are caught — a silent failure would let one in.
    h.state.errors["categories.select"] = {
      message: "boom",
      code: "PGRST205",
    };
    await expect(
      addCategory(prev, form({ name: "Fuel", kind: "expense" })),
    ).rejects.toThrow(/Could not load categories/);
  });
});

describe("renameCategory", () => {
  it("updates only the addressed row's name", async () => {
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "Makanan" }),
    );
    expect(r.error).toBeUndefined();
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(update.payload).toEqual({ name: "Makanan" });
    expect(update.filters).toContainEqual(["id", "c-food"]);
  });

  it("trims the new name", async () => {
    await renameCategory(prev, form({ id: "c-food", name: "  Makanan  " }));
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(update.payload).toEqual({ name: "Makanan" });
  });

  it("leaves the mark alone, so colours on screen don't reshuffle", async () => {
    await renameCategory(prev, form({ id: "c-food", name: "Makanan" }));
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(update.payload).not.toHaveProperty("color");
  });

  it("rejects a blank name", async () => {
    const r = await renameCategory(prev, form({ id: "c-food", name: "  " }));
    expect(r.error).toBe("Give the category a name.");
    expect(h.state.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("rejects an over-long name", async () => {
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "x".repeat(41) }),
    );
    expect(r.error).toBe("Keep the name under 40 characters.");
  });

  it("rejects a rename onto a sibling of the same kind", async () => {
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "transport" }),
    );
    expect(r.error).toBe(
      'You already have an expense category called "transport".',
    );
    expect(h.state.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("allows renaming a category to its own name unchanged", async () => {
    // Self-collision would otherwise block re-casing, e.g. "Bills" -> "BILLS".
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "FOOD & DRINK" }),
    );
    expect(r.error).toBeUndefined();
  });

  it("allows a name already taken by the other kind", async () => {
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "Salary" }),
    );
    expect(r.error).toBeUndefined();
  });

  it("reports a category that vanished between page load and submit", async () => {
    const r = await renameCategory(prev, form({ id: "gone", name: "Makanan" }));
    expect(r.error).toBe("That category no longer exists.");
    expect(h.state.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("rejects a missing id", async () => {
    const r = await renameCategory(prev, form({ id: "", name: "Makanan" }));
    expect(r.error).toBe("That category no longer exists.");
  });

  it("surfaces an update error", async () => {
    h.state.errors["categories.update"] = { message: "denied" };
    const r = await renameCategory(
      prev,
      form({ id: "c-food", name: "Makanan" }),
    );
    expect(r.error).toBe("denied");
  });
});

describe("deleteCategory", () => {
  it("deletes the addressed category", async () => {
    await deleteCategory(form({ id: "c-food" }));
    const del = h.state.calls.find((c) => c.op === "delete")!;
    expect(del.table).toBe("categories");
    expect(del.filters).toContainEqual(["id", "c-food"]);
  });

  it("does nothing without an id, rather than deleting unfiltered", async () => {
    await deleteCategory(form({ id: "" }));
    expect(h.state.calls).toHaveLength(0);
  });

  it("throws when the delete fails", async () => {
    h.state.errors["categories.delete"] = { message: "denied" };
    await expect(deleteCategory(form({ id: "c-food" }))).rejects.toThrow(
      /Could not delete the category/,
    );
  });
});

describe("addCategory — agreement with the database's unique index", () => {
  // Migration 0003 indexes (user_id, kind, lower(btrim(name))). If the action's
  // idea of "the same name" ever drifts from that expression, the UI and the
  // database disagree: either a duplicate slips past the check and the insert
  // dies with a raw 23505, or the action refuses a name Postgres would accept.
  // These lock the two together for every name the action can actually store.
  const key = (s: string) => s.trim().toLowerCase();

  it.each([
    ["exact", "Fuel", "Fuel"],
    ["upper vs lower", "FUEL", "fuel"],
    ["mixed case", "FuEl", "fUeL"],
    ["leading spaces", "  Fuel", "Fuel"],
    ["trailing spaces", "Fuel  ", "Fuel"],
    ["both sides", "  Fuel  ", "Fuel"],
  ])("treats %s as the same name", async (_label, typed, stored) => {
    h.state.data["categories"] = [
      { id: "c-x", name: stored, kind: "expense", color: "#a1584a" },
    ];
    const r = await addCategory(prev, form({ name: typed, kind: "expense" }));
    expect(r.error).toMatch(/already have an expense category/);
    expect(key(typed)).toBe(key(stored));
  });

  it.each([
    ["internal spacing", "Food  Drink", "Food Drink"],
    ["an accent", "Café", "Cafe"],
    ["a trailing word", "Fuel Extra", "Fuel"],
  ])("treats %s as a different name", async (_label, typed, stored) => {
    h.state.data["categories"] = [
      { id: "c-x", name: stored, kind: "expense", color: "#a1584a" },
    ];
    const r = await addCategory(prev, form({ name: typed, kind: "expense" }));
    expect(r.error).toBeUndefined();
    expect(key(typed)).not.toBe(key(stored));
  });

  it("never stores edge whitespace, which is what keeps btrim() and trim() equivalent", async () => {
    // The one place the two expressions could diverge is a tab- or
    // newline-padded name; the action trims before inserting, so no such row
    // can reach the index through the UI.
    for (const typed of ["  Fuel  ", "\tFuel\t", "\nFuel\n", " \t Fuel \n "]) {
      h.state = createHarness();
      h.state.data["categories"] = [];
      await addCategory(prev, form({ name: typed, kind: "expense" }));
      const stored = (inserted() as { name: string }).name;
      expect(stored).toBe("Fuel");
      expect(stored).toBe(stored.trim());
    }
  });

  it("scopes collisions by kind, exactly as the index does", async () => {
    h.state.data["categories"] = [
      { id: "c-x", name: "Travel", kind: "income", color: "#0d7a56" },
    ];
    const r = await addCategory(prev, form({ name: "travel", kind: "expense" }));
    expect(r.error).toBeUndefined();
  });
});

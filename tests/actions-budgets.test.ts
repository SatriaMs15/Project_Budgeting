import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createHarness,
  makeClient,
  form,
  type HarnessState,
} from "./supabase-harness";
import { monthStart } from "@/lib/date";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));

const { setBudget } = await import("@/app/actions/budgets");

beforeEach(() => {
  h.state = createHarness();
});

describe("setBudget — saving a limit", () => {
  it("upserts the limit for the current month", async () => {
    await setBudget(form({ category_id: "cat-1", limit_amount: "2000000" }));

    const call = h.state.calls.at(-1)!;
    expect(call.op).toBe("upsert");
    expect(call.payload).toMatchObject({
      category_id: "cat-1",
      month: monthStart(),
      limit_amount: 2_000_000,
      user_id: "user-1",
    });
  });

  it("keys the upsert on user+category+month so re-saving replaces", async () => {
    await setBudget(form({ category_id: "cat-1", limit_amount: "500000" }));
    expect(h.state.calls.at(-1)!.options).toMatchObject({
      onConflict: "user_id,category_id,month",
    });
  });

  it("rounds a fractional limit to whole rupiah", async () => {
    await setBudget(form({ category_id: "cat-1", limit_amount: "1000.7" }));
    expect(h.state.calls.at(-1)!.payload).toMatchObject({ limit_amount: 1001 });
  });

  it("handles a 9-digit limit", async () => {
    await setBudget(form({ category_id: "cat-1", limit_amount: "125000000" }));
    expect(h.state.calls.at(-1)!.payload).toMatchObject({
      limit_amount: 125_000_000,
    });
  });
});

describe("setBudget — clearing a limit", () => {
  it.each([
    ["zero", "0"],
    ["empty", ""],
    ["negative", "-100"],
    ["letters", "abc"],
  ])("deletes the budget when the limit is %s", async (_label, limit_amount) => {
    await setBudget(form({ category_id: "cat-1", limit_amount }));

    const call = h.state.calls.at(-1)!;
    expect(call.op).toBe("delete");
    expect(call.filters).toContainEqual(["category_id", "cat-1"]);
    expect(call.filters).toContainEqual(["month", monthStart()]);
  });

  it("scopes the delete to the current month only", async () => {
    await setBudget(form({ category_id: "cat-1", limit_amount: "0" }));
    const months = h.state.calls
      .at(-1)!
      .filters.filter(([c]) => c === "month");
    expect(months).toHaveLength(1);
  });
});

describe("setBudget — guards", () => {
  it("does nothing without a category", async () => {
    await setBudget(form({ category_id: "", limit_amount: "1000" }));
    expect(h.state.calls).toHaveLength(0);
  });

  it("does nothing when there is no signed-in user", async () => {
    h.state.user = null;
    await setBudget(form({ category_id: "cat-1", limit_amount: "1000" }));
    // The user lookup may happen, but nothing is written.
    expect(h.state.calls.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  it("throws rather than failing silently when the upsert is rejected", async () => {
    h.state.errors["budgets.upsert"] = { message: "denied", code: "42501" };
    await expect(
      setBudget(form({ category_id: "cat-1", limit_amount: "1000" })),
    ).rejects.toThrow(/Could not save the budget/);
  });

  it("throws when clearing fails", async () => {
    h.state.errors["budgets.delete"] = { message: "denied" };
    await expect(
      setBudget(form({ category_id: "cat-1", limit_amount: "0" })),
    ).rejects.toThrow(/Could not clear the budget/);
  });
});

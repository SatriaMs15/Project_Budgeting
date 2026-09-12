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

const { addRule, deleteRule } = await import("@/app/actions/recurring");

const prev = { ts: 0 };
const valid = {
  amount: "2500000",
  kind: "expense",
  frequency: "monthly",
  category_id: "cat-1",
  note: "Rent",
  next_run_on: "2026-10-01",
};

beforeEach(() => {
  h.state = createHarness();
});

describe("addRule — valid input", () => {
  it("creates the rule", async () => {
    const r = await addRule(prev, form(valid));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toMatchObject({
      amount: 2_500_000,
      kind: "expense",
      frequency: "monthly",
      category_id: "cat-1",
      note: "Rent",
      next_run_on: "2026-10-01",
    });
  });

  it.each(["weekly", "monthly"])("accepts %s", async (frequency) => {
    const r = await addRule(prev, form({ ...valid, frequency }));
    expect(r.error).toBeUndefined();
  });
});

describe("addRule — amount input", () => {
  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["letters", "lots"],
    ["fractional", "10.5"],
  ])("rejects a %s amount", async (_label, amount) => {
    const r = await addRule(prev, form({ ...valid, amount }));
    expect(r.error).toBe("Enter an amount greater than 0.");
    expect(h.state.calls).toHaveLength(0);
  });
});

describe("addRule — kind and frequency input", () => {
  it("rejects an unknown kind", async () => {
    const r = await addRule(prev, form({ ...valid, kind: "spend" }));
    expect(r.error).toBe("Pick income or expense.");
  });

  it.each([
    ["daily", "daily"],
    ["empty", ""],
    ["capitalised", "Monthly"],
  ])("rejects %s as a frequency", async (_label, frequency) => {
    const r = await addRule(prev, form({ ...valid, frequency }));
    expect(r.error).toBe("Pick a frequency.");
  });
});

describe("addRule — start date input", () => {
  it("requires a start date", async () => {
    const r = await addRule(prev, form({ ...valid, next_run_on: "" }));
    expect(r.error).toBe("Pick a start date.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("requires the field to be present at all", async () => {
    const r = await addRule(prev, form({ ...valid, next_run_on: undefined }));
    expect(r.error).toBe("Pick a start date.");
  });
});

describe("addRule — optional fields", () => {
  it("stores a null note when blank", async () => {
    await addRule(prev, form({ ...valid, note: "  " }));
    expect(h.state.calls[0].payload).toMatchObject({ note: null });
  });

  it("stores a null category when none is chosen", async () => {
    await addRule(prev, form({ ...valid, category_id: "" }));
    expect(h.state.calls[0].payload).toMatchObject({ category_id: null });
  });
});

describe("deleteRule", () => {
  it("deletes the addressed rule", async () => {
    await deleteRule(form({ id: "r1" }));
    expect(h.state.calls[0].op).toBe("delete");
    expect(h.state.calls[0].filters).toContainEqual(["id", "r1"]);
  });

  it("throws when the delete fails", async () => {
    h.state.errors["recurring_rules.delete"] = { message: "denied" };
    await expect(deleteRule(form({ id: "r1" }))).rejects.toThrow(
      /Could not delete the recurring item/,
    );
  });
});

describe("addRule — start date validity", () => {
  it.each([
    ["free text", "someday"],
    ["an impossible day", "2026-02-30"],
    ["a slash format", "01/10/2026"],
  ])("rejects %s", async (_label, next_run_on) => {
    const r = await addRule(prev, form({ ...valid, next_run_on }));
    expect(r.error).toBe("Enter a valid start date.");
    expect(h.state.calls).toHaveLength(0);
  });
});

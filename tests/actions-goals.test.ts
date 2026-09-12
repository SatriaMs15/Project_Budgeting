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

const { addGoal, contributeToGoal, deleteGoal } = await import(
  "@/app/actions/goals"
);

const prev = { ts: 0 };

beforeEach(() => {
  h.state = createHarness();
});

describe("addGoal — name input", () => {
  it("accepts a name and target", async () => {
    const r = await addGoal(prev, form({ name: "New phone", target_amount: "20000000" }));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toMatchObject({
      name: "New phone",
      target_amount: 20_000_000,
    });
  });

  it("rejects a blank name", async () => {
    const r = await addGoal(prev, form({ name: "", target_amount: "1000" }));
    expect(r.error).toBe("Give the goal a name.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("rejects a whitespace-only name", async () => {
    const r = await addGoal(prev, form({ name: "   ", target_amount: "1000" }));
    expect(r.error).toBe("Give the goal a name.");
  });

  it("trims the stored name", async () => {
    await addGoal(prev, form({ name: "  Trip  ", target_amount: "1000" }));
    expect(h.state.calls[0].payload).toMatchObject({ name: "Trip" });
  });
});

describe("addGoal — target amount input", () => {
  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["letters", "soon"],
    ["fractional", "10.5"],
  ])("rejects a %s target", async (_label, target_amount) => {
    const r = await addGoal(prev, form({ name: "Goal", target_amount }));
    expect(r.error).toBe("Enter a target amount greater than 0.");
  });

  it("rejects a missing target", async () => {
    const r = await addGoal(prev, form({ name: "Goal" }));
    expect(r.error).toBe("Enter a target amount greater than 0.");
  });
});

describe("addGoal — target date input", () => {
  it("stores null when no date is given", async () => {
    await addGoal(prev, form({ name: "Goal", target_amount: "1000" }));
    expect(h.state.calls[0].payload).toMatchObject({ target_date: null });
  });

  it("stores the date when one is given", async () => {
    await addGoal(
      prev,
      form({ name: "Goal", target_amount: "1000", target_date: "2026-12-25" }),
    );
    expect(h.state.calls[0].payload).toMatchObject({ target_date: "2026-12-25" });
  });
});

describe("contributeToGoal", () => {
  beforeEach(() => {
    h.state.data["savings_goals"] = { saved_amount: 5_000_000 };
  });

  it("adds to the existing saved amount", async () => {
    await contributeToGoal(form({ id: "g1", amount: "1000000" }));
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(update.payload).toMatchObject({ saved_amount: 6_000_000 });
  });

  it.each([
    ["zero", "0"],
    ["negative", "-500"],
    ["letters", "abc"],
    ["fractional", "1.5"],
  ])("ignores a %s contribution", async (_label, amount) => {
    await contributeToGoal(form({ id: "g1", amount }));
    expect(h.state.calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("ignores a contribution with no goal id", async () => {
    await contributeToGoal(form({ id: "", amount: "1000" }));
    expect(h.state.calls).toHaveLength(0);
  });

  it("does nothing when the goal no longer exists", async () => {
    h.state.data["savings_goals"] = undefined as never;
    await contributeToGoal(form({ id: "gone", amount: "1000" }));
    expect(h.state.calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("throws when the read fails, rather than treating it as absent", async () => {
    // A failed read must not look the same as a deleted goal.
    h.state.errors["savings_goals.maybeSingle"] = {
      message: "boom",
      code: "PGRST205",
    };
    await expect(contributeToGoal(form({ id: "g1", amount: "1000" }))).rejects.toThrow(
      /Could not load the goal/,
    );
  });
});

describe("deleteGoal", () => {
  it("deletes the addressed goal", async () => {
    await deleteGoal(form({ id: "g1" }));
    expect(h.state.calls[0].op).toBe("delete");
    expect(h.state.calls[0].filters).toContainEqual(["id", "g1"]);
  });

  it("throws when the delete fails", async () => {
    h.state.errors["savings_goals.delete"] = { message: "denied" };
    await expect(deleteGoal(form({ id: "g1" }))).rejects.toThrow(
      /Could not delete the goal/,
    );
  });
});

describe("addGoal — target date validity", () => {
  it.each([
    ["free text", "someday"],
    ["an impossible day", "2026-02-30"],
    ["a slash format", "25/12/2026"],
  ])("rejects %s", async (_label, target_date) => {
    const r = await addGoal(
      prev,
      form({ name: "Goal", target_amount: "1000", target_date }),
    );
    expect(r.error).toBe("Enter a valid target date.");
    expect(h.state.calls).toHaveLength(0);
  });
});

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

const {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} = await import("@/app/actions/transactions");

const prev = { ts: 0 };

beforeEach(() => {
  h.state = createHarness();
});

const valid = {
  amount: "50000",
  kind: "expense",
  category_id: "cat-1",
  note: "Lunch",
  occurred_on: "2026-09-12",
};

describe("addTransaction — amount input", () => {
  it("accepts a positive whole number", async () => {
    const r = await addTransaction(prev, form(valid));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toMatchObject({ amount: 50000 });
  });

  it.each([
    ["zero", "0"],
    ["negative", "-5000"],
    ["empty", ""],
    ["letters", "abc"],
    ["only a currency symbol", "Rp"],
  ])("rejects %s", async (_label, amount) => {
    const r = await addTransaction(prev, form({ ...valid, amount }));
    expect(r.error).toBe("Enter an amount greater than 0.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("rejects a fractional amount — IDR has no minor unit", async () => {
    const r = await addTransaction(prev, form({ ...valid, amount: "1500.5" }));
    expect(r.error).toBe("Enter an amount greater than 0.");
  });

  it("rejects a missing amount field entirely", async () => {
    const r = await addTransaction(prev, form({ ...valid, amount: undefined }));
    expect(r.error).toBe("Enter an amount greater than 0.");
  });

  it("accepts a 9-digit amount without precision loss", async () => {
    await addTransaction(prev, form({ ...valid, amount: "125000000" }));
    expect(h.state.calls[0].payload).toMatchObject({ amount: 125_000_000 });
  });

  it("rejects Infinity and NaN", async () => {
    for (const amount of ["Infinity", "NaN", "1e999"]) {
      const r = await addTransaction(prev, form({ ...valid, amount }));
      expect(r.error).toBe("Enter an amount greater than 0.");
    }
  });
});

describe("addTransaction — kind input", () => {
  it.each(["income", "expense"])("accepts %s", async (kind) => {
    const r = await addTransaction(prev, form({ ...valid, kind }));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toMatchObject({ kind });
  });

  it.each([
    ["a typo", "expence"],
    ["empty", ""],
    ["uppercase", "EXPENSE"],
  ])("rejects %s", async (_label, kind) => {
    const r = await addTransaction(prev, form({ ...valid, kind }));
    expect(r.error).toBe("Pick income or expense.");
    expect(h.state.calls).toHaveLength(0);
  });
});

describe("addTransaction — optional fields", () => {
  it("stores a null note when blank, not an empty string", async () => {
    await addTransaction(prev, form({ ...valid, note: "   " }));
    expect(h.state.calls[0].payload).toMatchObject({ note: null });
  });

  it("trims surrounding whitespace from the note", async () => {
    await addTransaction(prev, form({ ...valid, note: "  Lunch  " }));
    expect(h.state.calls[0].payload).toMatchObject({ note: "Lunch" });
  });

  it("stores a null category when none is chosen", async () => {
    await addTransaction(prev, form({ ...valid, category_id: "" }));
    expect(h.state.calls[0].payload).toMatchObject({ category_id: null });
  });

  it("omits the date when blank so the DB default applies", async () => {
    await addTransaction(prev, form({ ...valid, occurred_on: "" }));
    const payload = h.state.calls[0].payload as Record<string, unknown>;
    expect(payload.occurred_on).toBeUndefined();
  });
});

describe("addTransaction — database failure", () => {
  it("returns the error rather than pretending it worked", async () => {
    h.state.errors["transactions.insert"] = { message: "nope", code: "42501" };
    const r = await addTransaction(prev, form(valid));
    expect(r.error).toBe("nope");
  });

  it("advances ts on every call so the form can react", async () => {
    const ok = await addTransaction(prev, form(valid));
    expect(ok.ts).toBeGreaterThan(0);
    const bad = await addTransaction(prev, form({ ...valid, amount: "0" }));
    expect(bad.ts).toBeGreaterThan(0);
  });
});

describe("updateTransaction", () => {
  const withId = { ...valid, id: "tx-1" };

  it("updates the addressed row", async () => {
    const r = await updateTransaction(prev, form(withId));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].op).toBe("update");
    expect(h.state.calls[0].filters).toContainEqual(["id", "tx-1"]);
  });

  it("refuses without an id", async () => {
    const r = await updateTransaction(prev, form({ ...valid, id: "" }));
    expect(r.error).toBe("Missing transaction.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("applies the same amount rules as adding", async () => {
    const r = await updateTransaction(prev, form({ ...withId, amount: "0" }));
    expect(r.error).toBe("Enter an amount greater than 0.");
  });

  it("applies the same kind rules as adding", async () => {
    const r = await updateTransaction(prev, form({ ...withId, kind: "x" }));
    expect(r.error).toBe("Pick income or expense.");
  });

  it("leaves the date untouched when the field is blank", async () => {
    await updateTransaction(prev, form({ ...withId, occurred_on: "" }));
    const payload = h.state.calls[0].payload as Record<string, unknown>;
    expect(payload.occurred_on).toBeUndefined();
  });
});

describe("deleteTransaction", () => {
  it("deletes the addressed row", async () => {
    await deleteTransaction(form({ id: "tx-9" }));
    expect(h.state.calls[0].op).toBe("delete");
    expect(h.state.calls[0].filters).toContainEqual(["id", "tx-9"]);
  });

  it("throws a DataError when the delete fails", async () => {
    h.state.errors["transactions.delete"] = { message: "denied", code: "42501" };
    await expect(deleteTransaction(form({ id: "tx-9" }))).rejects.toThrow(
      /Could not delete the transaction/,
    );
  });
});

describe("addTransaction — date input", () => {
  it("accepts a real date", async () => {
    const r = await addTransaction(prev, form({ ...valid, occurred_on: "2026-09-12" }));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toMatchObject({ occurred_on: "2026-09-12" });
  });

  it.each([
    ["free text", "not-a-date"],
    ["a slash format", "12/09/2026"],
    ["an unpadded month", "2026-9-5"],
    ["an impossible day", "2026-02-30"],
    ["a 13th month", "2026-13-01"],
  ])("rejects %s rather than sending it to Postgres", async (_label, occurred_on) => {
    // Before this guard the value went straight to the database and came back
    // as a raw "invalid input syntax for type date" error.
    const r = await addTransaction(prev, form({ ...valid, occurred_on }));
    expect(r.error).toBe("Enter a valid date.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("still allows a blank date so the DB default applies", async () => {
    const r = await addTransaction(prev, form({ ...valid, occurred_on: "" }));
    expect(r.error).toBeUndefined();
  });
});

describe("updateTransaction — date input", () => {
  it("rejects an invalid date", async () => {
    const r = await updateTransaction(
      prev,
      form({ ...valid, id: "tx-1", occurred_on: "nope" }),
    );
    expect(r.error).toBe("Enter a valid date.");
    expect(h.state.calls).toHaveLength(0);
  });
});

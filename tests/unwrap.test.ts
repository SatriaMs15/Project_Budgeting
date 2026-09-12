import { describe, it, expect } from "vitest";
import { unwrap, assertOk, DataError } from "@/lib/supabase/unwrap";

describe("unwrap", () => {
  it("returns the data when the query succeeded", () => {
    const rows = [{ id: "1" }, { id: "2" }];
    expect(unwrap({ data: rows, error: null }, "load things")).toBe(rows);
  });

  it("passes through a null from .maybeSingle()", () => {
    expect(unwrap({ data: null, error: null }, "load one thing")).toBeNull();
  });

  it("throws rather than returning an empty array — the whole point", () => {
    // Destructuring only `data` is what let a missing table look like an
    // empty state for weeks. It must be impossible to get [] out of a failure.
    expect(() =>
      unwrap({ data: null, error: { message: "boom" } }, "load goals"),
    ).toThrow(DataError);
  });

  it("names the failed operation in the message", () => {
    expect(() =>
      unwrap({ data: null, error: { message: "boom" } }, "load goals"),
    ).toThrow(/Could not load goals: boom/);
  });
});

describe("DataError explanations", () => {
  it("explains PGRST205 as a missing table or stale schema cache", () => {
    const err = new DataError("load goals", {
      message: "Could not find the table",
      code: "PGRST205",
    });
    expect(err.code).toBe("PGRST205");
    expect(err.message).toContain("[PGRST205]");
    expect(err.message).toMatch(/table is missing|schema cache/i);
    expect(err.message).toContain("reload schema");
  });

  it("explains 42501 as an RLS rejection", () => {
    const err = new DataError("insert", { message: "denied", code: "42501" });
    expect(err.message).toMatch(/Row Level Security/i);
  });

  it("explains PGRST301 as a rejected or expired token", () => {
    const err = new DataError("load", { message: "jwt", code: "PGRST301" });
    expect(err.message).toMatch(/expired|rejected/i);
  });

  it("falls back to the server's hint for unrecognised codes", () => {
    const err = new DataError("load", {
      message: "odd",
      code: "XX999",
      hint: "try turning it off and on again",
    });
    expect(err.message).toContain("try turning it off and on again");
  });

  it("omits the code bracket when there is no code", () => {
    const err = new DataError("load", { message: "plain" });
    expect(err.code).toBeNull();
    expect(err.message).not.toContain("[");
  });

  it("is a real Error subclass so boundaries can catch it", () => {
    const err = new DataError("load", { message: "x" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("DataError");
  });
});

describe("assertOk", () => {
  it("returns silently on success", () => {
    expect(() => assertOk({ error: null }, "write")).not.toThrow();
  });

  it("throws on a failed write", () => {
    expect(() => assertOk({ error: { message: "nope" } }, "save budget")).toThrow(
      /Could not save budget: nope/,
    );
  });
});

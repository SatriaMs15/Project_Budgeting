import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRule } from "./helpers";
import type { RecurringRule } from "@/lib/supabase/types";

/* A minimal stand-in for the supabase-js builder, recording what was written. */
type Insert = { occurred_on: string; amount: number; kind: string };

const state = vi.hoisted(() => ({
  rules: [] as RecurringRule[],
  inserted: [] as Insert[],
  advancedTo: [] as { id: string; next_run_on: string }[],
  insertError: null as { message: string; code?: string } | null,
  selectError: null as { message: string; code?: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      if (table === "recurring_rules") {
        return {
          select: () => ({
            eq: () => ({
              lte: async () => ({
                data: state.selectError ? null : state.rules,
                error: state.selectError,
              }),
            }),
          }),
          update: (patch: { next_run_on: string }) => ({
            eq: async (_col: string, id: string) => {
              state.advancedTo.push({ id, next_run_on: patch.next_run_on });
              return { error: null };
            },
          }),
        };
      }
      return {
        insert: async (rows: Insert[]) => {
          if (state.insertError) return { error: state.insertError };
          state.inserted.push(...rows);
          return { error: null };
        },
      };
    },
  }),
}));

// today() is read from lib/date; freeze it so the catch-up window is fixed.
vi.mock("@/lib/date", async (orig) => ({
  ...(await orig<typeof import("@/lib/date")>()),
  today: () => "2026-09-12",
}));

const { materializeDueRecurring } = await import("@/lib/recurring");

beforeEach(() => {
  state.rules = [];
  state.inserted = [];
  state.advancedTo = [];
  state.insertError = null;
  state.selectError = null;
});

describe("materializeDueRecurring — nothing to do", () => {
  it("writes nothing when no rule is due", async () => {
    await materializeDueRecurring();
    expect(state.inserted).toHaveLength(0);
    expect(state.advancedTo).toHaveLength(0);
  });
});

describe("materializeDueRecurring — posting", () => {
  it("posts one transaction for a rule due today", async () => {
    state.rules = [makeRule({ next_run_on: "2026-09-12" })];
    await materializeDueRecurring();

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      occurred_on: "2026-09-12",
      amount: 2_500_000,
      kind: "expense",
    });
  });

  it("advances the rule past today so a rerun is a no-op", async () => {
    state.rules = [makeRule({ next_run_on: "2026-09-12" })];
    await materializeDueRecurring();

    expect(state.advancedTo).toEqual([
      { id: "rule-1", next_run_on: "2026-10-12" },
    ]);
    expect(state.advancedTo[0].next_run_on > "2026-09-12").toBe(true);
  });

  it("catches up every missed month at once", async () => {
    state.rules = [makeRule({ next_run_on: "2026-06-12" })];
    await materializeDueRecurring();

    expect(state.inserted.map((i) => i.occurred_on)).toEqual([
      "2026-06-12",
      "2026-07-12",
      "2026-08-12",
      "2026-09-12",
    ]);
  });

  it("catches up weekly rules on a seven-day stride", async () => {
    state.rules = [
      makeRule({ frequency: "weekly", next_run_on: "2026-08-22" }),
    ];
    await materializeDueRecurring();

    expect(state.inserted.map((i) => i.occurred_on)).toEqual([
      "2026-08-22",
      "2026-08-29",
      "2026-09-05",
      "2026-09-12",
    ]);
  });

  it("rolls a monthly rule across a year boundary", async () => {
    state.rules = [makeRule({ next_run_on: "2025-11-30" })];
    await materializeDueRecurring();

    const dates = state.inserted.map((i) => i.occurred_on);
    expect(dates[0]).toBe("2025-11-30");
    expect(dates).toContain("2025-12-30");
    expect(dates).toContain("2026-01-30");
    // Every posting must be a real, ordered date.
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...dates].sort()).toEqual(dates);
  });

  it("handles a 31st start date rolling through short months", async () => {
    // new Date(y, m, 31) overflows into the next month — the dates stay valid
    // and strictly increasing, which is what the catch-up loop relies on.
    state.rules = [makeRule({ next_run_on: "2026-01-31" })];
    await materializeDueRecurring();

    const dates = state.inserted.map((i) => i.occurred_on);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) {
      expect(new Date(`${d}T00:00:00`).toString()).not.toBe("Invalid Date");
    }
    expect([...new Set(dates)].length).toBe(dates.length); // no duplicates
    expect([...dates].sort()).toEqual(dates); // strictly ordered
  });

  it("carries the rule's category and note onto each transaction", async () => {
    state.rules = [makeRule({ next_run_on: "2026-09-12" })];
    await materializeDueRecurring();

    expect(state.inserted[0]).toMatchObject({
      category_id: "cat-food",
      note: "Rent",
    });
  });

  it("processes several due rules independently", async () => {
    state.rules = [
      makeRule({ id: "a", next_run_on: "2026-09-12", note: "Rent" }),
      makeRule({
        id: "b",
        next_run_on: "2026-09-12",
        note: "Salary",
        kind: "income",
      }),
    ];
    await materializeDueRecurring();

    expect(state.inserted).toHaveLength(2);
    expect(state.advancedTo.map((a) => a.id)).toEqual(["a", "b"]);
  });
});

describe("materializeDueRecurring — failures surface", () => {
  it("throws when the rules query fails instead of silently skipping", async () => {
    state.selectError = { message: "boom", code: "PGRST205" };
    await expect(materializeDueRecurring()).rejects.toThrow(
      /Could not load due recurring rules/,
    );
  });

  it("throws — and does not advance the rule — when the insert fails", async () => {
    // Advancing after a failed insert would silently skip a month's postings.
    state.rules = [makeRule({ next_run_on: "2026-09-12" })];
    state.insertError = { message: "denied", code: "42501" };

    await expect(materializeDueRecurring()).rejects.toThrow(
      /Could not create transactions from a recurring rule/,
    );
    expect(state.advancedTo).toHaveLength(0);
  });
});

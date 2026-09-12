import { describe, it, expect } from "vitest";
import {
  ASSIGNABLE_EXPENSE_MARKS,
  categoryColor,
  pickCategoryColor,
} from "@/lib/category-colors";
import { CHART } from "@/lib/chart-colors";
import type { Kind } from "@/lib/supabase/types";

const SEEDED: { name: string; kind: Kind; color: string }[] = [
  { name: "Food & Drink", kind: "expense", color: "#a1584a" },
  { name: "Transport", kind: "expense", color: "#667488" },
  { name: "Shopping", kind: "expense", color: "#82733a" },
  { name: "Bills", kind: "expense", color: "#55716f" },
  { name: "Entertainment", kind: "expense", color: "#6c5b7d" },
  { name: "Health", kind: "expense", color: "#96586a" },
  { name: "Other", kind: "expense", color: "#767272" },
  { name: "Salary", kind: "income", color: "#0d7a56" },
];

describe("categoryColor honours a stored mark", () => {
  it("uses the stored colour for a name the design never named", () => {
    const mark = ASSIGNABLE_EXPENSE_MARKS[3];
    expect(categoryColor({ name: "Fuel", kind: "expense", color: mark })).toBe(
      mark,
    );
  });

  it("ignores a stored colour that is not a ledger mark", () => {
    // Pre-redesign accounts hold bright hues; honouring those would break the
    // palette, so they fall back to the neutral like any unknown category.
    const loud = categoryColor({
      name: "Fuel",
      kind: "expense",
      color: "#ff00ff",
    });
    expect(loud).not.toBe("#ff00ff");
    expect(loud).toBe(categoryColor({ name: "Fuel", kind: "expense" }));
  });

  it("still lets the design's names win over whatever is stored", () => {
    // A legacy row may carry an old hue under a name the palette does define.
    expect(
      categoryColor({ name: "Bills", kind: "expense", color: "#22c55e" }),
    ).toBe(categoryColor({ name: "Bills", kind: "expense" }));
  });

  it("keeps income on the income ink whatever is stored", () => {
    expect(
      categoryColor({ name: "Freelance", kind: "income", color: "#ff00ff" }),
    ).toBe(CHART.incomeInk);
  });

  it("tolerates a null or absent stored colour", () => {
    expect(
      categoryColor({ name: "Fuel", kind: "expense", color: null }),
    ).toMatch(/^#[0-9a-f]{6}$/i);
    expect(categoryColor({ name: "Fuel", kind: "expense" })).toMatch(
      /^#[0-9a-f]{6}$/i,
    );
  });
});

describe("pickCategoryColor", () => {
  it("always returns a mark from the assignable palette", () => {
    const mark = pickCategoryColor("expense", SEEDED);
    expect(ASSIGNABLE_EXPENSE_MARKS).toContain(mark);
  });

  it("never hands out the neutral fallback, which reads as 'unrecognised'", () => {
    const fallback = categoryColor({ name: "Nothing here", kind: "expense" });
    expect(ASSIGNABLE_EXPENSE_MARKS).not.toContain(fallback);
  });

  it("gives every income category the same income ink", () => {
    expect(pickCategoryColor("income", SEEDED)).toBe(CHART.incomeInk);
    expect(pickCategoryColor("income", [])).toBe(CHART.incomeInk);
  });

  it("hands out unused marks first on a fresh account", () => {
    const picked: { name: string; kind: Kind; color: string }[] = [];
    for (let i = 0; i < ASSIGNABLE_EXPENSE_MARKS.length; i++) {
      const color = pickCategoryColor("expense", picked);
      picked.push({ name: `Cat ${i}`, kind: "expense", color });
    }
    expect(new Set(picked.map((c) => c.color)).size).toBe(
      ASSIGNABLE_EXPENSE_MARKS.length,
    );
  });

  it("wraps around once the palette is exhausted rather than failing", () => {
    const full = ASSIGNABLE_EXPENSE_MARKS.map((color, i) => ({
      name: `Cat ${i}`,
      kind: "expense" as Kind,
      color,
    }));
    expect(ASSIGNABLE_EXPENSE_MARKS).toContain(
      pickCategoryColor("expense", full),
    );
  });

  it("reuses a mark freed by a deletion instead of drifting past it", () => {
    // A running counter would keep advancing; counting usage reclaims the gap.
    const freed = ASSIGNABLE_EXPENSE_MARKS[2];
    const existing = ASSIGNABLE_EXPENSE_MARKS.filter((m) => m !== freed).map(
      (color, i) => ({ name: `Cat ${i}`, kind: "expense" as Kind, color }),
    );
    expect(pickCategoryColor("expense", existing)).toBe(freed);
  });

  it("ignores income categories when spreading expense marks", () => {
    const incomeOnly = [
      { name: "Salary", kind: "income" as Kind, color: "#0d7a56" },
      { name: "Bonus", kind: "income" as Kind, color: "#0d7a56" },
    ];
    expect(pickCategoryColor("expense", incomeOnly)).toBe(
      ASSIGNABLE_EXPENSE_MARKS[0],
    );
  });

  it("is deterministic for the same set of categories", () => {
    expect(pickCategoryColor("expense", SEEDED)).toBe(
      pickCategoryColor("expense", SEEDED),
    );
  });

  it("survives an empty account", () => {
    expect(pickCategoryColor("expense", [])).toBe(ASSIGNABLE_EXPENSE_MARKS[0]);
  });
});

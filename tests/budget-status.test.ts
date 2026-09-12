import { describe, it, expect } from "vitest";
import { budgetStatus, statusColor } from "@/components/budget-row";
import { CHART } from "@/lib/chart-colors";

describe("budgetStatus thresholds", () => {
  it("is 'none' when no limit is set", () => {
    expect(budgetStatus(0, 0)).toBe("none");
    expect(budgetStatus(500_000, 0)).toBe("none");
  });

  it("is 'under' below 80% of the limit", () => {
    expect(budgetStatus(0, 1_000_000)).toBe("under");
    expect(budgetStatus(799_999, 1_000_000)).toBe("under");
  });

  it("is 'near' from 80% up to but not including 100%", () => {
    expect(budgetStatus(800_000, 1_000_000)).toBe("near");
    expect(budgetStatus(999_999, 1_000_000)).toBe("near");
  });

  it("is 'over' at exactly 100% and beyond", () => {
    expect(budgetStatus(1_000_000, 1_000_000)).toBe("over");
    expect(budgetStatus(2_500_000, 1_000_000)).toBe("over");
  });

  it("treats a negative limit as no limit rather than inverting", () => {
    expect(budgetStatus(100, -5)).toBe("none");
  });

  it("holds its boundaries across magnitudes", () => {
    for (const limit of [1_000, 250_000, 8_500_000, 125_000_000]) {
      expect(budgetStatus(Math.floor(limit * 0.79), limit)).toBe("under");
      expect(budgetStatus(Math.ceil(limit * 0.8), limit)).toBe("near");
      expect(budgetStatus(limit, limit)).toBe("over");
    }
  });
});

describe("statusColor", () => {
  it("maps each status to its documented ink", () => {
    expect(statusColor("under")).toBe(CHART.incomeInk);
    expect(statusColor("near")).toBe(CHART.accent);
    expect(statusColor("over")).toBe(CHART.negative);
  });

  it("never uses the income/expense pair to signal budget health", () => {
    // Budget status is a different axis from money direction; reusing the
    // expense blue here would make "over budget" read as "this is an expense".
    for (const s of ["under", "near", "over", "none"] as const) {
      expect(statusColor(s)).not.toBe(CHART.expense);
      expect(statusColor(s)).not.toBe(CHART.expenseInk);
    }
  });

  it("gives every status a distinct colour", () => {
    const colors = (["under", "near", "over", "none"] as const).map(statusColor);
    expect(new Set(colors).size).toBe(4);
  });
});

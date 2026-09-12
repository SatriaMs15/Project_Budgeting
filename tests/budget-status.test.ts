import { describe, it, expect } from "vitest";
import {
  budgetStatus,
  statusColor,
  summarizeBudgets,
} from "@/components/budget-row";
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

describe("summarizeBudgets", () => {
  it("counts only budgeted categories on BOTH sides", () => {
    // The bug this guards: spending from unbudgeted categories used to be
    // summed against only-budgeted limits, so the overall line went "over"
    // while every individual row still said it was fine.
    const summary = summarizeBudgets([
      { spent: 1_850_000, limit: 2_000_000 }, // budgeted
      { spent: 1_250_000, limit: 0 }, // no limit — must not count
      { spent: 890_000, limit: 0 }, // no limit — must not count
    ]);

    expect(summary.spent).toBe(1_850_000);
    expect(summary.budgeted).toBe(2_000_000);
    expect(summary.status).toBe("near");
    expect(summary.overCount).toBe(0);
  });

  it("never reports 'over' while every category is within its limit", () => {
    const rows = [
      { spent: 100_000, limit: 1_000_000 },
      { spent: 200_000, limit: 1_000_000 },
      { spent: 9_000_000, limit: 0 },
    ];
    const summary = summarizeBudgets(rows);

    expect(summary.overCount).toBe(0);
    expect(summary.status).not.toBe("over");
  });

  it("reports the aggregate ratio in `status`", () => {
    // 1.6M spent of 2M budgeted is 80% — "near" in aggregate, even though one
    // category inside it is over.
    const summary = summarizeBudgets([
      { spent: 1_500_000, limit: 1_000_000 },
      { spent: 100_000, limit: 1_000_000 },
    ]);
    expect(summary.status).toBe("near");
  });

  it("surfaces the worst single category in `worst`, which drives the colour", () => {
    // The design colours the overall line to the worst status, so one blown
    // budget shows up even while the totals still look healthy.
    const summary = summarizeBudgets([
      { spent: 1_500_000, limit: 1_000_000 },
      { spent: 100_000, limit: 1_000_000 },
    ]);
    expect(summary.worst).toBe("over");
    expect(summary.overCount).toBe(1);
  });

  it("takes the worst status even when it is only 'near'", () => {
    const summary = summarizeBudgets([
      { spent: 850_000, limit: 1_000_000 },
      { spent: 100_000, limit: 1_000_000 },
    ]);
    expect(summary.worst).toBe("near");
    expect(summary.overCount).toBe(0);
  });

  it("reports 'none' as the worst when nothing is budgeted", () => {
    expect(summarizeBudgets([{ spent: 5_000, limit: 0 }]).worst).toBe("none");
  });

  it("flags no limits at all, rather than dividing by zero", () => {
    const summary = summarizeBudgets([
      { spent: 500_000, limit: 0 },
      { spent: 250_000, limit: 0 },
    ]);
    expect(summary.hasLimits).toBe(false);
    expect(summary.budgeted).toBe(0);
    expect(summary.spent).toBe(0);
    expect(summary.status).toBe("none");
  });

  it("handles an empty category list", () => {
    const summary = summarizeBudgets([]);
    expect(summary.hasLimits).toBe(false);
    expect(summary.overCount).toBe(0);
  });

  it("counts each over-budget category once", () => {
    const summary = summarizeBudgets([
      { spent: 2_000_000, limit: 1_000_000 },
      { spent: 3_000_000, limit: 1_000_000 },
      { spent: 100_000, limit: 1_000_000 },
    ]);
    expect(summary.overCount).toBe(2);
  });
});

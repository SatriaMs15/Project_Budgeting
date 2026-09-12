import { describe, it, expect } from "vitest";
import {
  describeCategoryDeletion,
  NO_USAGE,
  type CategoryUsage,
} from "@/lib/category-usage";

function usage(over: Partial<CategoryUsage> = {}): CategoryUsage {
  return { ...NO_USAGE, ...over };
}

describe("describeCategoryDeletion — the destructive half", () => {
  it("says nothing is destroyed when no budget references the category", () => {
    const { destroyed } = describeCategoryDeletion(
      usage({ transactions: 9, recurring: 2 }),
    );
    expect(destroyed).toHaveLength(0);
  });

  it("warns that budget limits are deleted for good", () => {
    const { destroyed } = describeCategoryDeletion(usage({ budgetMonths: 3 }));
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toContain("3 budget limits");
    expect(destroyed[0]).toContain("deleted for good");
  });

  it("counts a single month in the singular", () => {
    const { destroyed } = describeCategoryDeletion(usage({ budgetMonths: 1 }));
    expect(destroyed[0]).toContain("1 budget limit ");
    expect(destroyed[0]).not.toContain("limits");
  });

  it("names this month's figure so the loss is concrete", () => {
    const { destroyed } = describeCategoryDeletion(
      usage({ budgetMonths: 2, currentLimit: 2_000_000 }),
    );
    // formatIDR emits a non-breaking space after "Rp".
    expect(destroyed[0]).toContain("Rp 2.000.000");
    expect(destroyed[0]).toContain("this month");
  });

  it("survives a nine-digit limit", () => {
    const { destroyed } = describeCategoryDeletion(
      usage({ budgetMonths: 1, currentLimit: 125_000_000 }),
    );
    expect(destroyed[0]).toContain("Rp 125.000.000");
  });

  it("omits the figure when a past month has a limit but this one does not", () => {
    const { destroyed } = describeCategoryDeletion(
      usage({ budgetMonths: 2, currentLimit: null }),
    );
    expect(destroyed[0]).toContain("2 budget limits");
    expect(destroyed[0]).not.toContain("this month");
  });
});

describe("describeCategoryDeletion — what survives", () => {
  it("says transactions keep their amounts and go Uncategorized", () => {
    const { preserved } = describeCategoryDeletion(usage({ transactions: 12 }));
    expect(preserved).toHaveLength(1);
    expect(preserved[0]).toContain("12 transactions");
    expect(preserved[0]).toContain("Uncategorized");
  });

  it("counts a single transaction in the singular", () => {
    const { preserved } = describeCategoryDeletion(usage({ transactions: 1 }));
    expect(preserved[0]).toBe(
      "1 transaction keeps its amount and date, but becomes Uncategorized.",
    );
  });

  it("says recurring items keep running", () => {
    const { preserved } = describeCategoryDeletion(usage({ recurring: 2 }));
    expect(preserved[0]).toContain("2 recurring items keep");
    expect(preserved[0]).toContain("without a category");
  });

  it("counts a single recurring item in the singular", () => {
    const { preserved } = describeCategoryDeletion(usage({ recurring: 1 }));
    expect(preserved[0]).toContain("1 recurring item keeps");
  });

  it("lists both kinds of survivor when both apply", () => {
    const { preserved } = describeCategoryDeletion(
      usage({ transactions: 4, recurring: 1 }),
    );
    expect(preserved).toHaveLength(2);
  });

  it("never confuses a destroyed budget for a survivor", () => {
    const { preserved } = describeCategoryDeletion(
      usage({ budgetMonths: 3, currentLimit: 500_000 }),
    );
    expect(preserved).toHaveLength(0);
  });
});

describe("describeCategoryDeletion — an unused category", () => {
  it("reports nothing at all on either side", () => {
    const { destroyed, preserved } = describeCategoryDeletion(NO_USAGE);
    expect(destroyed).toHaveLength(0);
    expect(preserved).toHaveLength(0);
  });
});

describe("describeCategoryDeletion — a heavily used category", () => {
  it("reports the cascade and the survivors separately", () => {
    const { destroyed, preserved } = describeCategoryDeletion(
      usage({
        transactions: 138,
        recurring: 2,
        budgetMonths: 6,
        currentLimit: 3_500_000,
      }),
    );
    expect(destroyed).toHaveLength(1);
    expect(preserved).toHaveLength(2);
    expect(destroyed.join(" ")).not.toContain("transaction");
  });
});

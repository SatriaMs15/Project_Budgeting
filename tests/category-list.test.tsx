import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { makeCategory } from "./helpers";
import { NO_USAGE, type CategoryUsage } from "@/lib/category-usage";

vi.mock("@/app/actions/categories", () => ({
  addCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const { CategoryList } = await import("@/components/category-list");

const categories = [
  makeCategory({ id: "c-food", name: "Food & Drink" }),
  makeCategory({ id: "c-bills", name: "Bills", color: "#55716f" }),
  makeCategory({ id: "c-salary", name: "Salary", kind: "income" }),
];

function usageMap(
  entries: Record<string, Partial<CategoryUsage>> = {},
): Map<string, CategoryUsage> {
  return new Map(
    categories.map((c) => [c.id, { ...NO_USAGE, ...(entries[c.id] ?? {}) }]),
  );
}

describe("CategoryList structure", () => {
  it("splits the ledger into expense and income sections", () => {
    render(<CategoryList categories={categories} usageById={usageMap()} />);
    expect(screen.getByText("Expense")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
  });

  it("renders the column headers for each section", () => {
    render(<CategoryList categories={categories} usageById={usageMap()} />);
    expect(screen.getAllByText("Category")).toHaveLength(2);
    expect(screen.getAllByText("Transactions")).toHaveLength(2);
    expect(screen.getAllByText("Limit this month")).toHaveLength(2);
  });

  it("lists every category by name", () => {
    render(<CategoryList categories={categories} usageById={usageMap()} />);
    for (const name of ["Food & Drink", "Bills", "Salary"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("files each category under its own kind", () => {
    const { container } = render(
      <CategoryList categories={categories} usageById={usageMap()} />,
    );
    const [expense, income] = Array.from(container.querySelectorAll("section"));
    expect(
      within(expense as HTMLElement).getByText("Bills"),
    ).toBeInTheDocument();
    expect(
      within(income as HTMLElement).getByText("Salary"),
    ).toBeInTheDocument();
    expect(within(income as HTMLElement).queryByText("Bills")).toBeNull();
  });

  it("marks each category with its palette colour", () => {
    render(<CategoryList categories={categories} usageById={usageMap()} />);
    expect(screen.getByText("Bills")).toHaveStyle({ color: "#55716f" });
  });
});

describe("CategoryList usage columns", () => {
  it("shows how many entries and rules reference a category", () => {
    render(
      <CategoryList
        categories={categories}
        usageById={usageMap({
          "c-food": { transactions: 12, recurring: 2 },
        })}
      />,
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("entries")).toBeInTheDocument();
    expect(screen.getByText("rules")).toBeInTheDocument();
  });

  it("uses the singular for a count of one", () => {
    render(
      <CategoryList
        categories={categories}
        usageById={usageMap({ "c-food": { transactions: 1, recurring: 1 } })}
      />,
    );
    expect(screen.getByText("entry")).toBeInTheDocument();
    expect(screen.getByText("rule")).toBeInTheDocument();
  });

  it("shows this month's limit when one is set", () => {
    const { container } = render(
      <CategoryList
        categories={categories}
        usageById={usageMap({
          "c-food": { budgetMonths: 1, currentLimit: 2_000_000 },
        })}
      />,
    );
    // formatIDR emits a non-breaking space after "Rp".
    expect(container.textContent).toContain("Rp 2,000,000");
  });

  it("does not clip a nine-digit limit into the next column", () => {
    const { container } = render(
      <CategoryList
        categories={categories}
        usageById={usageMap({
          "c-food": { budgetMonths: 1, currentLimit: 125_000_000 },
        })}
      />,
    );
    expect(container.textContent).toContain("Rp 125,000,000");
  });

  it("leaves an em dash where there is nothing to report", () => {
    const { container } = render(
      <CategoryList categories={categories} usageById={usageMap()} />,
    );
    expect(container.textContent).toContain("—");
  });
});

describe("CategoryList controls", () => {
  it("offers rename and delete on every row", () => {
    render(<CategoryList categories={categories} usageById={usageMap()} />);
    for (const name of ["Food & Drink", "Bills", "Salary"]) {
      expect(
        screen.getByRole("button", { name: `Rename ${name}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `Delete ${name}` }),
      ).toBeInTheDocument();
    }
  });
});

describe("CategoryList empty states", () => {
  it("explains an account with no categories at all", () => {
    render(<CategoryList categories={[]} usageById={new Map()} />);
    expect(screen.getByText(/You have no categories/i)).toBeInTheDocument();
  });

  it("notes a kind with no categories without hiding the section", () => {
    render(
      <CategoryList
        categories={[makeCategory({ id: "c-food" })]}
        usageById={new Map()}
      />,
    );
    expect(screen.getByText("No income categories.")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
  });

  it("falls back to zero usage for a category with no counts loaded", () => {
    render(
      <CategoryList
        categories={[makeCategory({ id: "c-food" })]}
        usageById={new Map()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Delete Food & Drink" }),
    ).toBeInTheDocument();
  });
});

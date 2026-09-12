import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeCategory, makeRule } from "./helpers";

vi.mock("@/app/actions/recurring", () => ({
  deleteRule: vi.fn(),
  addRule: vi.fn(),
}));

const { RecurringList } = await import("@/components/recurring-list");

const categories = [
  makeCategory(),
  makeCategory({ id: "cat-salary", name: "Salary", kind: "income" }),
];

describe("RecurringList empty state", () => {
  it("explains what recurring items are for", () => {
    render(<RecurringList rules={[]} categories={categories} />);
    expect(screen.getByText(/Nothing repeating yet/i)).toBeInTheDocument();
  });
});

describe("RecurringList rows", () => {
  const rules = [
    makeRule({ id: "r1", note: "Rent", amount: 2_500_000 }),
    makeRule({
      id: "r2",
      note: "Salary",
      amount: 8_500_000,
      kind: "income",
      category_id: "cat-salary",
      frequency: "weekly",
      next_run_on: "2026-09-20",
    }),
  ];

  it("renders the ledger column headers", () => {
    render(<RecurringList rules={rules} categories={categories} />);
    for (const h of ["Description", "Category", "Amount", "Cadence", "Next run"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("signs income and expense in opposite directions", () => {
    const { container } = render(
      <RecurringList rules={rules} categories={categories} />,
    );
    expect(container.textContent).toContain("−Rp 2,500,000");
    expect(container.textContent).toContain("+Rp 8,500,000");
  });

  it("spells out the cadence", () => {
    render(<RecurringList rules={rules} categories={categories} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("shows the next run date", () => {
    render(<RecurringList rules={rules} categories={categories} />);
    expect(screen.getByText("01 Oct 2026")).toBeInTheDocument();
  });

  it("labels the stop control with the item it stops", () => {
    render(<RecurringList rules={rules} categories={categories} />);
    expect(screen.getByLabelText("Stop Rent")).toBeInTheDocument();
  });

  it("falls back to the category name when a rule has no note", () => {
    render(
      <RecurringList
        rules={[makeRule({ note: null })]}
        categories={categories}
      />,
    );
    expect(screen.getAllByText("Food & Drink")).toHaveLength(2);
  });

  it("keeps the fixed grid in its own scroll container", () => {
    const { container } = render(
      <RecurringList rules={rules} categories={categories} />,
    );
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory, makeTransaction } from "./helpers";

vi.mock("@/app/actions/transactions", () => ({
  deleteTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  addTransaction: vi.fn(),
}));

const { TransactionList } = await import("@/components/transaction-list");

const categories = [
  makeCategory(),
  makeCategory({ id: "cat-salary", name: "Salary", kind: "income" }),
];

const NB = " ";

describe("TransactionList empty state", () => {
  it("says nothing is recorded rather than showing an empty table", () => {
    render(<TransactionList transactions={[]} categories={categories} />);
    expect(screen.getByText(/Nothing recorded yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Register")).not.toBeInTheDocument();
  });
});

describe("TransactionList register", () => {
  const txns = [
    makeTransaction({ id: "a", note: "Lunch", amount: 100_000 }),
    makeTransaction({
      id: "b",
      note: "Payday",
      amount: 8_500_000,
      kind: "income",
      category_id: "cat-salary",
    }),
  ];

  it("renders the ledger column headers", () => {
    render(<TransactionList transactions={txns} categories={categories} />);
    for (const h of ["Date", "Description", "Category", "Amount"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("signs expenses and income in opposite directions", () => {
    // The sign and the figure are separate text nodes inside one span, so
    // match on the span's combined textContent.
    const { container } = render(
      <TransactionList transactions={txns} categories={categories} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(`−Rp${NB}100,000`);
    expect(text).toContain(`+Rp${NB}8,500,000`);
  });

  it("uses a true minus sign, not a hyphen", () => {
    const { container } = render(
      <TransactionList transactions={txns} categories={categories} />,
    );
    expect(container.textContent).toContain("−"); // U+2212
  });

  it("shows the category as a tag alongside the description", () => {
    render(<TransactionList transactions={txns} categories={categories} />);
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Food & Drink")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("falls back to the category name when a transaction has no note", () => {
    render(
      <TransactionList
        transactions={[makeTransaction({ note: null })]}
        categories={categories}
      />,
    );
    // Once as the description, once as the tag.
    expect(screen.getAllByText("Food & Drink")).toHaveLength(2);
  });

  it("labels an unknown category rather than rendering a blank cell", () => {
    render(
      <TransactionList
        transactions={[makeTransaction({ category_id: null, note: "Odd" })]}
        categories={categories}
      />,
    );
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("formats dates as a compact numeric day-first string", () => {
    render(
      <TransactionList
        transactions={[makeTransaction({ occurred_on: "2026-09-05" })]}
        categories={categories}
      />,
    );
    expect(screen.getByText("05/09/2026")).toBeInTheDocument();
  });

  it("gives every row an edit and a delete control", () => {
    render(<TransactionList transactions={txns} categories={categories} />);
    expect(screen.getAllByLabelText("Edit transaction")).toHaveLength(2);
    expect(screen.getAllByLabelText("Delete transaction")).toHaveLength(2);
  });
});

describe("TransactionList pagination", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    makeTransaction({ id: `t${i}`, note: `Item ${i}`, amount: (i + 1) * 1000 }),
  );

  it("shows only the first page and reports the count", () => {
    render(<TransactionList transactions={many} categories={categories} />);
    expect(screen.getByText("Showing 9 of 25")).toBeInTheDocument();
    expect(screen.getByText("Item 8")).toBeInTheDocument();
    expect(screen.queryByText("Item 9")).not.toBeInTheDocument();
  });

  it("reveals another page on Load more and updates the count", async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={many} categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getByText("Showing 18 of 25")).toBeInTheDocument();
    expect(screen.getByText("Item 9")).toBeInTheDocument();
  });

  it("hides Load more once everything is shown", async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={many} categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getByText("Showing 25 of 25")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Load more when everything already fits", () => {
    render(
      <TransactionList transactions={many.slice(0, 5)} categories={categories} />,
    );
    expect(screen.getByText("Showing 5 of 5")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });
});

describe("TransactionList layout guarantees", () => {
  it("keeps the fixed grid inside a horizontally scrollable container", () => {
    // This is what stops a narrow viewport from breaking the page layout.
    const { container } = render(
      <TransactionList
        transactions={[makeTransaction()]}
        categories={categories}
      />,
    );
    const scroller = container.querySelector(".overflow-x-auto");
    expect(scroller).not.toBeNull();
    expect(within(scroller as HTMLElement).getByText("Lunch")).toBeInTheDocument();
  });
});

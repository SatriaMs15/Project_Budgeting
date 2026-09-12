import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory } from "./helpers";
import type { ProposedRow } from "@/lib/csv";

vi.mock("@/app/actions/import", () => ({
  importTransactions: vi.fn(async () => ({ ts: 0 })),
  extractTransactions: vi.fn(async () => ({ ts: 0 })),
}));

const { ImportReview } = await import("@/components/import-review");

const categories = [
  makeCategory({ id: "c1", name: "Food & Drink", kind: "expense" }),
  makeCategory({ id: "c3", name: "Salary", kind: "income" }),
];

function row(over: Partial<ProposedRow> = {}): ProposedRow {
  return {
    occurred_on: "2026-09-05",
    note: "Warung lunch",
    amount: 25_000,
    kind: "expense",
    suggested_category: "Food & Drink",
    ...over,
  };
}

describe("ImportReview table", () => {
  it("counts what was found", () => {
    render(
      <ImportReview rows={[row(), row()]} categories={categories} onReset={vi.fn()} />,
    );
    expect(screen.getByText(/2 transactions found/i)).toBeInTheDocument();
  });

  it("uses the singular for one row", () => {
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);
    expect(screen.getByText(/1 transaction found/i)).toBeInTheDocument();
  });

  it("renders the column headers", () => {
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);
    for (const h of ["Date", "Description", "Amount", "Kind", "Category"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("prefills every extracted field so review is editing, not retyping", () => {
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);
    expect(screen.getByDisplayValue("Warung lunch")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-09-05")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25.000")).toBeInTheDocument();
  });
});

describe("ImportReview low-confidence flag", () => {
  it("flags a row the model could not categorise", () => {
    render(
      <ImportReview
        rows={[row({ suggested_category: "" })]}
        categories={categories}
        onReset={vi.fn()}
        aiUsed
      />,
    );
    expect(screen.getByText(/Low confidence/i)).toBeInTheDocument();
  });

  it("does not flag a row that matched a known category", () => {
    render(
      <ImportReview
        rows={[row()]}
        categories={categories}
        onReset={vi.fn()}
        aiUsed
      />,
    );
    expect(screen.queryByText(/Low confidence/i)).not.toBeInTheDocument();
  });

  it("preselects the suggested category when it matched", () => {
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("c1");
  });

  it("leaves an unmatched row uncategorised rather than guessing", () => {
    render(
      <ImportReview
        rows={[row({ suggested_category: "Nonexistent" })]}
        categories={categories}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});

describe("ImportReview kind toggle", () => {
  it("switches a row between expense and income", async () => {
    const user = userEvent.setup();
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /Kind: expense/i });
    expect(toggle).toHaveTextContent("Expense");

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: /Kind: income/i }),
    ).toHaveTextContent("Income");
  });

  it("drops a category that no longer belongs to the new kind", async () => {
    const user = userEvent.setup();
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveValue("c1"); // Food & Drink
    await user.click(screen.getByRole("button", { name: /Kind: expense/i }));

    // Food & Drink is an expense category; it must not stay selected on income.
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("offers only the new kind's categories after switching", async () => {
    const user = userEvent.setup();
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Kind: expense/i }));

    const select = screen.getByRole("combobox");
    expect(within(select).getByText("Salary")).toBeInTheDocument();
    expect(within(select).queryByText("Food & Drink")).toBeNull();
  });
});

describe("ImportReview row removal", () => {
  it("removes a row and updates the count", async () => {
    const user = userEvent.setup();
    render(
      <ImportReview
        rows={[row({ note: "Keep me" }), row({ note: "Drop me" })]}
        categories={categories}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText("Remove row")).toHaveLength(2);
    await user.click(screen.getAllByLabelText("Remove row")[1]);

    expect(screen.queryByDisplayValue("Drop me")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep me")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Import 1 transaction$/ }),
    ).toBeInTheDocument();
  });

  it("disables import once every row is removed", async () => {
    const user = userEvent.setup();
    render(<ImportReview rows={[row()]} categories={categories} onReset={vi.fn()} />);

    await user.click(screen.getByLabelText("Remove row"));
    expect(screen.getByRole("button", { name: /Import 0 transactions/ })).toBeDisabled();
  });

  it("hands Start over back to the parent", async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<ImportReview rows={[row()]} categories={categories} onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("ImportReview — confidence flag is meaningful", () => {
  it("flags an unmatched row only when the model actually tried", () => {
    render(
      <ImportReview
        rows={[row({ suggested_category: "" })]}
        categories={categories}
        onReset={vi.fn()}
        aiUsed
      />,
    );
    expect(screen.getByText(/Low confidence/i)).toBeInTheDocument();
  });

  it("flags nothing after a deterministic CSV parse", () => {
    // The CSV parser never suggests categories, so flagging would mark every
    // row — a warning on 100% of rows carries no information.
    render(
      <ImportReview
        rows={[row({ suggested_category: "" }), row({ suggested_category: "" })]}
        categories={categories}
        onReset={vi.fn()}
        aiUsed={false}
      />,
    );
    expect(screen.queryByText(/Low confidence/i)).not.toBeInTheDocument();
  });

  it("defaults to not flagging when the source is unknown", () => {
    render(
      <ImportReview
        rows={[row({ suggested_category: "" })]}
        categories={categories}
        onReset={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Low confidence/i)).not.toBeInTheDocument();
  });
});

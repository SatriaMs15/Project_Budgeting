import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory } from "./helpers";

vi.mock("@/app/actions/transactions", () => ({
  addTransaction: vi.fn(async () => ({ ts: 0 })),
  updateTransaction: vi.fn(async () => ({ ts: 0 })),
  deleteTransaction: vi.fn(),
}));

const { TransactionForm } = await import("@/components/transaction-form");

const categories = [
  makeCategory({ id: "c1", name: "Food & Drink", kind: "expense" }),
  makeCategory({ id: "c2", name: "Transport", kind: "expense" }),
  makeCategory({ id: "c3", name: "Salary", kind: "income" }),
  makeCategory({ id: "c4", name: "Bonus", kind: "income" }),
];

function amountField() {
  return screen.getAllByRole("textbox").find((el) => el.id === "amount")!;
}

describe("TransactionForm defaults", () => {
  it("starts on Expense — the common case", () => {
    render(<TransactionForm categories={categories} />);
    expect(screen.getByRole("radio", { name: "Expense" })).toBeChecked();
  });

  it("focuses the amount field so typing starts immediately", () => {
    render(<TransactionForm categories={categories} />);
    expect(amountField()).toHaveFocus();
  });

  it("defaults the date to today", () => {
    render(<TransactionForm categories={categories} />);
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText("Date")).toHaveValue(today);
  });
});

describe("TransactionForm category filtering", () => {
  it("offers only expense categories while on Expense", () => {
    render(<TransactionForm categories={categories} />);
    const select = screen.getByLabelText("Category");
    expect(within(select).queryByText("Salary")).toBeNull();
    expect(select).toHaveTextContent("Food & Drink");
    expect(select).toHaveTextContent("Transport");
  });

  it("swaps to income categories when Income is chosen", async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} />);

    await user.click(screen.getByRole("radio", { name: "Income" }));

    const select = screen.getByLabelText("Category");
    expect(select).toHaveTextContent("Salary");
    expect(select).toHaveTextContent("Bonus");
    expect(select).not.toHaveTextContent("Food & Drink");
  });

  it("posts the chosen kind as a hidden field", async () => {
    const user = userEvent.setup();
    const { container } = render(<TransactionForm categories={categories} />);

    const hidden = () =>
      container.querySelector<HTMLInputElement>("input[type=hidden][name=kind]")!;
    expect(hidden().value).toBe("expense");

    await user.click(screen.getByRole("radio", { name: "Income" }));
    expect(hidden().value).toBe("income");
  });
});

describe("TransactionForm quick amounts", () => {
  it("offers the four everyday amounts", () => {
    render(<TransactionForm categories={categories} />);
    for (const label of ["Rp 15.000", "Rp 50.000", "Rp 100.000", "Rp 250.000"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("fills the amount field when one is tapped", async () => {
    const user = userEvent.setup();
    const { container } = render(<TransactionForm categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Rp 50.000" }));

    expect(amountField()).toHaveValue("50.000");
    expect(
      container.querySelector<HTMLInputElement>("input[type=hidden][name=amount]")!
        .value,
    ).toBe("50000");
  });

  it("replaces rather than appends when a second chip is tapped", async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Rp 50.000" }));
    await user.click(screen.getByRole("button", { name: "Rp 250.000" }));

    expect(amountField()).toHaveValue("250.000");
  });

  it("returns focus to the amount field after a tap", async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} />);

    await user.click(screen.getByRole("button", { name: "Rp 15.000" }));
    expect(amountField()).toHaveFocus();
  });
});

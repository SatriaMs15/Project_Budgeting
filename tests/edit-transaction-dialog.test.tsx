import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory, makeTransaction } from "./helpers";

vi.mock("@/app/actions/transactions", () => ({
  addTransaction: vi.fn(async () => ({ ts: 0 })),
  updateTransaction: vi.fn(async () => ({ ts: 0 })),
  deleteTransaction: vi.fn(),
}));

const { EditTransactionDialog } = await import(
  "@/components/edit-transaction-dialog"
);

const categories = [
  makeCategory({ id: "c1", name: "Bills", kind: "expense" }),
  makeCategory({ id: "c2", name: "Food & Drink", kind: "expense" }),
  makeCategory({ id: "c3", name: "Salary", kind: "income" }),
];

async function open(transaction = makeTransaction()) {
  const user = userEvent.setup();
  render(
    <EditTransactionDialog transaction={transaction} categories={categories} />,
  );
  await user.click(screen.getByRole("button", { name: "Edit transaction" }));
  await screen.findByRole("heading", { name: "Edit transaction" });
  return user;
}

function categorySelect() {
  return screen.getByLabelText("Category");
}

describe("EditTransactionDialog category", () => {
  it("preselects the transaction's own category", async () => {
    await open(makeTransaction({ category_id: "c2" }));
    expect(categorySelect()).toHaveValue("c2");
  });

  it("preselects Uncategorized for a transaction with no category", async () => {
    // Regression: with no blank option, defaultValue="" matched nothing and the
    // browser fell back to the first category. Editing the note of an
    // Uncategorized entry then silently refiled it under "Bills".
    await open(makeTransaction({ category_id: null }));
    expect(categorySelect()).toHaveValue("");
  });

  it("does not show a real category as selected when there is none", async () => {
    await open(makeTransaction({ category_id: null }));
    const selected = within(categorySelect()).getByRole("option", {
      selected: true,
    });
    expect(selected).toHaveTextContent("Uncategorized");
    expect(selected).not.toHaveTextContent("Bills");
  });

  it("lets a filed transaction be deliberately unfiled", async () => {
    const user = await open(makeTransaction({ category_id: "c2" }));
    await user.selectOptions(categorySelect(), "");
    expect(categorySelect()).toHaveValue("");
  });

  it("keeps the category the user picked after switching kind back", async () => {
    const user = await open(makeTransaction({ category_id: "c2" }));
    await user.click(screen.getByText("Income"));
    expect(
      within(categorySelect()).getByRole("option", { name: "Uncategorized" }),
    ).toBeInTheDocument();
  });

  it("stays usable when every category of the kind is gone", async () => {
    render(
      <EditTransactionDialog
        transaction={makeTransaction({ category_id: null })}
        categories={[]}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit transaction" }));
    await screen.findByRole("heading", { name: "Edit transaction" });
    expect(within(categorySelect()).getAllByRole("option")).toHaveLength(1);
  });
});

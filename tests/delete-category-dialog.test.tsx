import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory } from "./helpers";
import { NO_USAGE, type CategoryUsage } from "@/lib/category-usage";

const deleteCategory = vi.fn();
vi.mock("@/app/actions/categories", () => ({
  deleteCategory: (fd: FormData) => deleteCategory(fd),
  renameCategory: vi.fn(),
  addCategory: vi.fn(),
}));

const { DeleteCategoryDialog } =
  await import("@/components/delete-category-dialog");

const category = makeCategory({ id: "c-food", name: "Food & Drink" });

function usage(over: Partial<CategoryUsage> = {}): CategoryUsage {
  return { ...NO_USAGE, ...over };
}

async function openDialog(over: Partial<CategoryUsage> = {}) {
  const user = userEvent.setup();
  render(<DeleteCategoryDialog category={category} usage={usage(over)} />);
  await user.click(screen.getByRole("button", { name: "Delete Food & Drink" }));
  return user;
}

describe("DeleteCategoryDialog — the guard itself", () => {
  it("does not delete on the first click", async () => {
    await openDialog({ transactions: 4 });
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("names the category it is about to delete", async () => {
    await openDialog();
    expect(screen.getByRole("heading")).toHaveTextContent("Food & Drink");
  });

  it("offers a way out", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("submits the category's id to the delete action", async () => {
    await openDialog();
    const submit = screen.getByRole("button", { name: "Delete category" });
    const form = submit.closest("form")!;
    expect(
      form.querySelector<HTMLInputElement>('input[name="id"]')?.value,
    ).toBe("c-food");
  });
});

describe("DeleteCategoryDialog — the budget cascade", () => {
  it("warns, in as many words, that the loss cannot be undone", async () => {
    await openDialog({ budgetMonths: 3, currentLimit: 2_000_000 });
    expect(screen.getByText(/This cannot be undone/i)).toBeInTheDocument();
  });

  it("says the budget limits are deleted for good", async () => {
    await openDialog({ budgetMonths: 3, currentLimit: 2_000_000 });
    expect(document.body.textContent).toContain("3 budget limits");
    expect(document.body.textContent).toContain("deleted for good");
  });

  it("names this month's figure", async () => {
    await openDialog({ budgetMonths: 1, currentLimit: 2_000_000 });
    // formatIDR emits a non-breaking space after "Rp".
    expect(document.body.textContent).toContain("Rp 2,000,000");
  });

  it("raises no cascade warning when no budget references the category", async () => {
    await openDialog({ transactions: 9 });
    expect(screen.queryByText(/This cannot be undone/i)).toBeNull();
  });
});

describe("DeleteCategoryDialog — what survives", () => {
  it("reassures that transactions keep their amounts", async () => {
    await openDialog({ transactions: 12 });
    expect(document.body.textContent).toContain("12 transactions");
    expect(document.body.textContent).toContain("Uncategorized");
  });

  it("reassures that recurring items keep running", async () => {
    await openDialog({ recurring: 2 });
    expect(document.body.textContent).toContain("2 recurring items keep");
  });

  it("separates what is destroyed from what is kept", async () => {
    await openDialog({ transactions: 12, budgetMonths: 2 });
    expect(screen.getByText("Kept")).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/i)).toBeInTheDocument();
  });

  it("says plainly when nothing else is affected", async () => {
    await openDialog();
    expect(
      screen.getByText(/Nothing is filed under this category yet/i),
    ).toBeInTheDocument();
  });
});

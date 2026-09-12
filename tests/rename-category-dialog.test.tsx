import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCategory } from "./helpers";

vi.mock("@/app/actions/categories", () => ({
  renameCategory: vi.fn(),
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const { RenameCategoryDialog } =
  await import("@/components/rename-category-dialog");

const category = makeCategory({ id: "c-food", name: "Food & Drink" });

async function openDialog() {
  const user = userEvent.setup();
  render(<RenameCategoryDialog category={category} />);
  await user.click(screen.getByRole("button", { name: "Rename Food & Drink" }));
  return user;
}

describe("RenameCategoryDialog", () => {
  it("stays closed until the pencil is clicked", () => {
    render(<RenameCategoryDialog category={category} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("opens with the current name already in the field", async () => {
    await openDialog();
    expect(screen.getByLabelText("Name")).toHaveValue("Food & Drink");
  });

  it("carries the category id so the action knows what to rename", async () => {
    await openDialog();
    expect(
      document.querySelector<HTMLInputElement>('input[name="id"]')?.value,
    ).toBe("c-food");
  });

  it("reassures that links to existing data survive a rename", async () => {
    await openDialog();
    expect(document.body.textContent).toMatch(
      /transactions, budgets and recurring items keep their link/i,
    );
  });

  it("caps the name at the length the action enforces", async () => {
    await openDialog();
    expect(screen.getByLabelText("Name")).toHaveAttribute("maxLength", "40");
  });

  it("offers a way out without saving", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

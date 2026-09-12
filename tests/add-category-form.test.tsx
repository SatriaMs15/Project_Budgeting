import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/categories", () => ({
  addCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

/**
 * Stand in for useActionState so a test can drive what the action "returned".
 * The real hook only changes state after a server round trip, which jsdom has
 * no way to perform.
 */
let actionState: { ts: number; error?: string } = { ts: 0 };
vi.mock("react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    ...react,
    useActionState: () => [actionState, vi.fn(), false],
  };
});

beforeEach(() => {
  actionState = { ts: 0 };
});

const { AddCategoryForm } = await import("@/components/add-category-form");

const nextMark = { expense: "#55716f", income: "#0d7a56" };

describe("AddCategoryForm fields", () => {
  it("asks for a name and nothing else the user must decide", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    // No colour picker: the mark is assigned, never chosen.
    expect(screen.queryByLabelText(/colou?r/i)).toBeNull();
  });

  it("defaults to an expense category", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByRole("radio", { name: "Expense" })).toBeChecked();
  });

  it("posts the chosen kind in a field the action reads", async () => {
    const user = userEvent.setup();
    const { container } = render(<AddCategoryForm nextMark={nextMark} />);
    const hidden = () =>
      container.querySelector<HTMLInputElement>('input[name="kind"]')!.value;

    expect(hidden()).toBe("expense");
    // The radio itself is visually hidden; the label carries the control.
    await user.click(screen.getByText("Income"));
    expect(hidden()).toBe("income");
  });

  it("caps the name at the length the action enforces", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("maxLength", "40");
  });
});

describe("AddCategoryForm mark preview", () => {
  it("shows the mark the category will actually be given", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByText("Preview")).toHaveStyle({ color: "#55716f" });
  });

  it("tells the user the mark is assigned for them", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByText("Assigned for you")).toBeInTheDocument();
  });

  it("previews the typed name as it is entered", async () => {
    const user = userEvent.setup();
    render(<AddCategoryForm nextMark={nextMark} />);
    await user.type(screen.getByLabelText("Name"), "Groceries");
    expect(screen.getByText("Groceries")).toHaveStyle({ color: "#55716f" });
  });

  it("switches to the income ink when the kind changes", async () => {
    const user = userEvent.setup();
    render(<AddCategoryForm nextMark={nextMark} />);
    await user.click(screen.getByText("Income"));
    expect(screen.getByText("Preview")).toHaveStyle({ color: "#0d7a56" });
  });

  it("falls back to a placeholder before anything is typed", () => {
    render(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });
});

describe("AddCategoryForm after a submit", () => {
  it("clears the name once an add succeeds", async () => {
    // A controlled input is component state: a `key` on the <form> remounts the
    // DOM node but not the state, so the name would otherwise stick around and
    // the next click would post a duplicate.
    const { rerender } = render(<AddCategoryForm nextMark={nextMark} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Groceries");
    expect(screen.getByLabelText("Name")).toHaveValue("Groceries");

    actionState = { ts: 1 };
    rerender(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps the typed name when the add is rejected", async () => {
    const { rerender } = render(<AddCategoryForm nextMark={nextMark} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Food & Drink");

    actionState = { ts: 2, error: "You already have an expense category." };
    rerender(<AddCategoryForm nextMark={nextMark} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Food & Drink");
    expect(
      screen.getByText("You already have an expense category."),
    ).toBeInTheDocument();
  });
});

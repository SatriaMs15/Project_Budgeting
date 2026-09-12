import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeGoal } from "./helpers";

vi.mock("@/app/actions/goals", () => ({
  contributeToGoal: vi.fn(),
  deleteGoal: vi.fn(),
  addGoal: vi.fn(),
}));

const { GoalCard } = await import("@/components/goal-card");

describe("GoalCard progress", () => {
  it("shows saved and target amounts", () => {
    render(<GoalCard goal={makeGoal()} />);
    expect(screen.getByText("Rp 5,000,000")).toBeInTheDocument();
    expect(screen.getByText("of Rp 20,000,000")).toBeInTheDocument();
  });

  it("reports what is left to save", () => {
    render(<GoalCard goal={makeGoal()} />);
    expect(screen.getByText("Rp 15,000,000 to go")).toBeInTheDocument();
  });

  it("fills the bar proportionally", () => {
    const { container } = render(<GoalCard goal={makeGoal()} />);
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("25%"); // 5M of 20M
  });

  it("caps the bar at 100% when over-saved", () => {
    const { container } = render(
      <GoalCard goal={makeGoal({ saved_amount: 25_000_000 })} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("100%");
  });

  it("does not divide by zero on a zero target", () => {
    const { container } = render(
      <GoalCard goal={makeGoal({ target_amount: 0, saved_amount: 0 })} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("0%");
  });
});

describe("GoalCard completion", () => {
  it("announces a reached goal without exclamation or emoji", () => {
    render(<GoalCard goal={makeGoal({ saved_amount: 20_000_000 })} />);
    expect(screen.getByText("Goal reached.")).toBeInTheDocument();
  });

  it("hides the contribution form once the goal is reached", () => {
    render(<GoalCard goal={makeGoal({ saved_amount: 20_000_000 })} />);
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("offers a contribution form while still saving", () => {
    render(<GoalCard goal={makeGoal()} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("switches the bar to the income ink when complete", () => {
    const { container } = render(
      <GoalCard goal={makeGoal({ saved_amount: 20_000_000 })} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.backgroundColor).toBe("rgb(13, 122, 86)"); // #0d7a56
  });

  it("uses the gold accent while in progress", () => {
    const { container } = render(<GoalCard goal={makeGoal()} />);
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.backgroundColor).toBe("rgb(182, 130, 53)"); // #b68235
  });
});

describe("GoalCard layout", () => {
  it("keeps each figure unbreakable so a big number never splits mid-digit", () => {
    // The row wraps as a whole instead; this is why large IDR targets are safe.
    const { container } = render(
      <GoalCard goal={makeGoal({ target_amount: 125_000_000 })} />,
    );
    const nowrap = container.querySelectorAll(".whitespace-nowrap");
    expect(nowrap.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a target date only when one is set", () => {
    const { rerender } = render(<GoalCard goal={makeGoal()} />);
    expect(screen.queryByText(/^by /)).not.toBeInTheDocument();

    rerender(<GoalCard goal={makeGoal({ target_date: "2026-12-25" })} />);
    expect(screen.getByText(/^by /)).toBeInTheDocument();
  });

  it("labels the delete control with the goal name", () => {
    render(<GoalCard goal={makeGoal()} />);
    expect(screen.getByLabelText("Delete goal New phone")).toBeInTheDocument();
  });
});

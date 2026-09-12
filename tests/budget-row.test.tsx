import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeCategory } from "./helpers";

vi.mock("@/app/actions/budgets", () => ({ setBudget: vi.fn() }));

const { BudgetRow } = await import("@/components/budget-row");

const category = makeCategory();

describe("BudgetRow status text", () => {
  it("states the status in words, not colour alone", () => {
    render(<BudgetRow category={category} spent={100_000} limit={1_000_000} />);
    expect(screen.getByText("Under")).toBeInTheDocument();
  });

  it("says Near in the 80–99% band", () => {
    render(<BudgetRow category={category} spent={850_000} limit={1_000_000} />);
    expect(screen.getByText("Near")).toBeInTheDocument();
  });

  it("says Over at or past the limit", () => {
    render(<BudgetRow category={category} spent={1_200_000} limit={1_000_000} />);
    expect(screen.getByText("Over")).toBeInTheDocument();
  });

  it("says No limit when none is set", () => {
    render(<BudgetRow category={category} spent={50_000} limit={0} />);
    expect(screen.getByText("No limit")).toBeInTheDocument();
  });
});

describe("BudgetRow figures", () => {
  it("shows spent of limit when a limit exists", () => {
    const { container } = render(
      <BudgetRow category={category} spent={100_000} limit={1_000_000} />,
    );
    expect(container.textContent).toContain("Rp 100,000");
    expect(container.textContent).toContain("of Rp 1,000,000");
  });

  it("shows spending only when there is no limit", () => {
    const { container } = render(
      <BudgetRow category={category} spent={50_000} limit={0} />,
    );
    expect(container.textContent).toContain("Rp 50,000");
    expect(container.textContent).not.toContain("of Rp");
  });

  it("names the category", () => {
    render(<BudgetRow category={category} spent={0} limit={0} />);
    expect(screen.getByText("Food & Drink")).toBeInTheDocument();
  });
});

describe("BudgetRow progress bar", () => {
  it("fills proportionally", () => {
    const { container } = render(
      <BudgetRow category={category} spent={250_000} limit={1_000_000} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("25%");
  });

  it("caps at 100% when over budget rather than overflowing", () => {
    const { container } = render(
      <BudgetRow category={category} spent={3_000_000} limit={1_000_000} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("100%");
  });

  it("stays empty with no limit set", () => {
    const { container } = render(
      <BudgetRow category={category} spent={999_999} limit={0} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("0%");
  });

  it("turns brick when over budget", () => {
    const { container } = render(
      <BudgetRow category={category} spent={1_000_000} limit={1_000_000} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.backgroundColor).toBe("rgb(168, 62, 42)"); // #a83e2a
  });
});

describe("BudgetRow limit form", () => {
  it("prefills the current limit so Save is an edit, not a re-entry", () => {
    render(<BudgetRow category={category} spent={0} limit={750_000} />);
    expect(screen.getByRole("textbox")).toHaveValue("750,000");
  });

  it("leaves the field empty when no limit is set", () => {
    render(<BudgetRow category={category} spent={0} limit={0} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("posts the category id with the limit", () => {
    const { container } = render(
      <BudgetRow category={category} spent={0} limit={0} />,
    );
    const hidden = container.querySelector<HTMLInputElement>(
      "input[type=hidden][name=category_id]",
    );
    expect(hidden?.value).toBe("cat-food");
  });
});

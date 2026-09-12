import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryLedger } from "@/components/charts/category-ledger";

// formatIDR emits a non-breaking space after "Rp". Testing Library
// normalizes a NODE's whitespace (NBSP becomes a plain space) but compares
// against the raw matcher string — so getByText queries use a normal space.

const data = [
  { name: "Bills", amount: 2_500_000, color: "#55716f" },
  { name: "Food & Drink", amount: 1_250_000, color: "#a1584a" },
  { name: "Transport", amount: 500_000, color: "#667488" },
];

describe("CategoryLedger", () => {
  it("tells the user nothing was spent rather than drawing an empty chart", () => {
    render(<CategoryLedger data={[]} />);
    expect(screen.getByText(/No spending recorded/i)).toBeInTheDocument();
  });

  it("numbers the entries like a contents page, zero-padded", () => {
    render(<CategoryLedger data={data} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("lists every category with its formatted amount", () => {
    render(<CategoryLedger data={data} />);
    expect(screen.getByText("Bills")).toBeInTheDocument();
    expect(screen.getByText("Rp 2.500.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 500.000")).toBeInTheDocument();
  });

  it("scales each intensity bar against the largest category", () => {
    const { container } = render(<CategoryLedger data={data} />);
    const bars = Array.from(
      container.querySelectorAll<HTMLElement>("div[style*='width']"),
    ).map((el) => el.style.width);

    expect(bars[0]).toBe("100%"); // the top category fills the rule
    expect(bars[1]).toBe("50%"); // 1.25M of 2.5M
    expect(bars[2]).toBe("20%"); // 0.5M of 2.5M
  });

  it("does not divide by zero when every amount is zero", () => {
    const { container } = render(
      <CategoryLedger data={[{ name: "Bills", amount: 0, color: "#55716f" }]} />,
    );
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.width).toBe("0%");
  });

  it("colours each bar with the category's own mark", () => {
    const { container } = render(<CategoryLedger data={data} />);
    const bar = container.querySelector<HTMLElement>("div[style*='width']");
    expect(bar?.style.backgroundColor).toBe("rgb(85, 113, 111)"); // #55716f
  });

  it("renders a dotted leader between name and figure", () => {
    // The leader is the visual device that makes this read as a ledger.
    const { container } = render(<CategoryLedger data={data} />);
    expect(container.querySelectorAll(".leader").length).toBe(3);
  });
});

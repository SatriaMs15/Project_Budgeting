import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.current,
}));

const { NavLinks } = await import("@/components/nav-links");

describe("NavLinks", () => {
  it("links to every screen", () => {
    mockPathname.current = "/";
    render(<NavLinks />);
    for (const label of [
      "Dashboard",
      "Transactions",
      "Budgets",
      "Categories",
      "Goals",
      "Recurring",
      "Import",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks Categories current on its own screen", () => {
    mockPathname.current = "/categories";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the current page for assistive tech", () => {
    mockPathname.current = "/budgets";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks only one link at a time", () => {
    mockPathname.current = "/goals";
    render(<NavLinks />);
    const current = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Goals");
  });

  it("does not let Dashboard match every route by prefix", () => {
    // "/" is a prefix of everything, so it has to match exactly or the
    // dashboard link would light up on every screen.
    mockPathname.current = "/transactions";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps a nested route highlighted under its section", () => {
    mockPathname.current = "/budgets/2026-09";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Budgets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

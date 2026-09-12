import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KindToggle } from "@/components/kind-toggle";

describe("KindToggle", () => {
  it("renders two native radios, so keyboard and AT work for free", () => {
    render(<KindToggle name="k" value="expense" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
  });

  it("reflects the selected kind", () => {
    render(<KindToggle name="k" value="income" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Income" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Expense" })).not.toBeChecked();
  });

  it("reports the other kind when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KindToggle name="k" value="expense" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Income" }));
    expect(onChange).toHaveBeenCalledWith("income");
  });

  it("does not fire when the already-selected option is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KindToggle name="k" value="expense" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Expense" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("groups both radios under one name so only one can be chosen", () => {
    render(<KindToggle name="mykind" value="expense" onChange={() => {}} />);
    for (const r of screen.getAllByRole("radio")) {
      expect(r).toHaveAttribute("name", "mykind");
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "@/components/money-input";

/** The hidden field is what the server action actually reads. */
function hiddenValue(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`input[type=hidden][name=${name}]`)!
    .value;
}

describe("MoneyInput display", () => {
  it("starts empty when there is no default", () => {
    render(<MoneyInput name="amount" />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("shows a grouped default value", () => {
    render(<MoneyInput name="amount" defaultValue={1_250_000} />);
    expect(screen.getByRole("textbox")).toHaveValue("1.250.000");
  });

  it("shows the Rp affix as static text, not part of the value", () => {
    render(<MoneyInput name="amount" defaultValue={5000} />);
    expect(screen.getByText("Rp")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("5.000");
  });
});

describe("MoneyInput submitted value", () => {
  it("posts the raw integer, not the formatted string", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);

    await user.type(screen.getByRole("textbox"), "1250000");

    expect(screen.getByRole("textbox")).toHaveValue("1.250.000");
    expect(hiddenValue(container, "amount")).toBe("1250000");
  });

  it("posts 0 for an empty field", () => {
    const { container } = render(<MoneyInput name="amount" />);
    expect(hiddenValue(container, "amount")).toBe("0");
  });

  it("keeps separators out of the posted value at 9 digits", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);

    await user.type(screen.getByRole("textbox"), "125000000");

    expect(screen.getByRole("textbox")).toHaveValue("125.000.000");
    expect(hiddenValue(container, "amount")).toBe("125000000");
  });

  it("ignores non-numeric characters as they are typed", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);

    await user.type(screen.getByRole("textbox"), "Rp 50abc000");

    expect(hiddenValue(container, "amount")).toBe("50000");
  });

  it("never produces a decimal — IDR has no minor unit", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);

    await user.type(screen.getByRole("textbox"), "1500.75");

    expect(hiddenValue(container, "amount")).not.toContain(".");
    expect(Number.isInteger(Number(hiddenValue(container, "amount")))).toBe(true);
  });
});

describe("MoneyInput controlled mode", () => {
  it("reports each change to the parent", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<MoneyInput name="amount" value={0} onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "5");
    expect(onValueChange).toHaveBeenCalledWith(5);
  });

  it("displays the value the parent supplies", () => {
    const { container } = render(
      <MoneyInput name="amount" value={250_000} onValueChange={() => {}} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("250.000");
    expect(hiddenValue(container, "amount")).toBe("250000");
  });

  it("does not drift from the parent's value when typed into", async () => {
    // A controlled field must not keep private state; the parent is the source
    // of truth, so with a fixed value the display stays put.
    const user = userEvent.setup();
    render(<MoneyInput name="amount" value={1000} onValueChange={() => {}} />);

    await user.type(screen.getByRole("textbox"), "9");
    expect(screen.getByRole("textbox")).toHaveValue("1.000");
  });
});

describe("MoneyInput accessibility and wiring", () => {
  it("uses a numeric keypad on mobile", () => {
    render(<MoneyInput name="amount" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("inputmode", "numeric");
  });

  it("forwards required to the visible field", () => {
    render(<MoneyInput name="amount" required />);
    expect(screen.getByRole("textbox")).toBeRequired();
  });

  it("calls the supplied key handler (Enter-to-submit relies on this)", async () => {
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    render(<MoneyInput name="amount" onKeyDown={onKeyDown} />);

    await user.type(screen.getByRole("textbox"), "{Enter}");
    expect(onKeyDown).toHaveBeenCalled();
  });
});

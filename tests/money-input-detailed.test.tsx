import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "@/components/money-input";
import { parseIDR, formatGrouped } from "@/lib/format";

/** The hidden field is what a server action actually receives. */
function submitted(container: HTMLElement, name = "amount") {
  return container.querySelector<HTMLInputElement>(
    `input[type=hidden][name=${name}]`,
  )!.value;
}

describe("MoneyInput — typing digit by digit", () => {
  it("regroups separators as each digit lands", async () => {
    const user = userEvent.setup();
    render(<MoneyInput name="amount" />);
    const field = screen.getByRole("textbox");

    const expected = ["1", "12", "123", "1.234", "12.345", "123.456"];
    for (const [i, want] of expected.entries()) {
      await user.type(field, String(i + 1));
      expect(field).toHaveValue(want);
    }
  });

  it("keeps the raw integer in step with the display throughout", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    const field = screen.getByRole("textbox");

    for (const digit of "1250000") {
      await user.type(field, digit);
      expect(parseIDR((field as HTMLInputElement).value)).toBe(
        Number(submitted(container)),
      );
    }
    expect(submitted(container)).toBe("1250000");
  });
});

describe("MoneyInput — editing existing values", () => {
  it("clears back to empty, submitting 0", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" defaultValue={50_000} />);
    const field = screen.getByRole("textbox");

    await user.clear(field);
    expect(field).toHaveValue("");
    expect(submitted(container)).toBe("0");
  });

  it("survives select-all then retype", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" defaultValue={50_000} />);
    const field = screen.getByRole("textbox");

    await user.tripleClick(field);
    await user.keyboard("99000");
    expect(field).toHaveValue("99.000");
    expect(submitted(container)).toBe("99000");
  });

  it("drops a leading zero rather than keeping 0123", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    await user.type(screen.getByRole("textbox"), "0123");
    expect(submitted(container)).toBe("123");
  });

  it("treats a lone zero as empty", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    await user.type(screen.getByRole("textbox"), "0");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(submitted(container)).toBe("0");
  });
});

describe("MoneyInput — pasted and malformed input", () => {
  it.each([
    ["a formatted rupiah string", "Rp 1.250.000", "1250000"],
    ["comma separators", "1,250,000", "1250000"],
    ["spaces", "1 250 000", "1250000"],
    ["a trailing decimal", "1500,75", "150075"],
    ["letters mixed in", "50rb", "50"],
    ["a negative sign", "-50000", "50000"],
    ["an emoji", "50000🎉", "50000"],
  ])("normalises %s", async (_label, typed, expected) => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    await user.type(screen.getByRole("textbox"), typed);
    expect(submitted(container)).toBe(expected);
  });

  it("ignores input that contains no digits at all", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    await user.type(screen.getByRole("textbox"), "abc!?");
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(submitted(container)).toBe("0");
  });
});

describe("MoneyInput — large amounts", () => {
  it.each([
    [1_000, "1.000"],
    [15_000, "15.000"],
    [1_250_000, "1.250.000"],
    [125_000_000, "125.000.000"],
    [1_000_000_000, "1.000.000.000"],
  ])("renders %i as %s", (amount, display) => {
    render(<MoneyInput name="amount" defaultValue={amount} />);
    expect(screen.getByRole("textbox")).toHaveValue(display);
  });

  it("stays an exact integer at a billion rupiah", async () => {
    const user = userEvent.setup();
    const { container } = render(<MoneyInput name="amount" />);
    await user.type(screen.getByRole("textbox"), "1000000000");
    expect(submitted(container)).toBe("1000000000");
    expect(Number.isSafeInteger(Number(submitted(container)))).toBe(true);
  });

  it("round-trips every magnitude through display and back", () => {
    for (const n of [1, 999, 1_000, 250_000, 8_500_000, 125_000_000]) {
      expect(parseIDR(formatGrouped(n))).toBe(n);
    }
  });
});

describe("MoneyInput — keyboard behaviour", () => {
  it("reports Enter to the parent so a form can submit", async () => {
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    render(<MoneyInput name="amount" onKeyDown={onKeyDown} />);

    await user.type(screen.getByRole("textbox"), "5000{Enter}");
    const keys = onKeyDown.mock.calls.map((c) => c[0].key);
    expect(keys).toContain("Enter");
  });

  it("can be focused programmatically via the forwarded ref", () => {
    function Harness() {
      const ref = { current: null as HTMLInputElement | null };
      return (
        <>
          <MoneyInput name="amount" inputRef={ref} />
          <button type="button" onClick={() => ref.current?.focus()}>
            focus
          </button>
        </>
      );
    }
    render(<Harness />);
    screen.getByRole("button", { name: "focus" }).click();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});

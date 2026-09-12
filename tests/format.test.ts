import { describe, it, expect } from "vitest";
import {
  formatIDR,
  formatGrouped,
  formatCompactIDR,
  parseIDR,
} from "@/lib/format";

// Intl for id-ID puts a NON-BREAKING space after "Rp". Asserting a plain
// space here would fail, and any code that string-matches the output needs
// to know this too.
const NB = " ";

describe("formatIDR", () => {
  it("groups with dots and prefixes Rp", () => {
    expect(formatIDR(1_250_000)).toBe(`Rp${NB}1.250.000`);
  });

  it("never shows decimals — IDR has no minor unit", () => {
    expect(formatIDR(1500)).toBe(`Rp${NB}1.500`);
    expect(formatIDR(1)).toBe(`Rp${NB}1`);
    expect(formatIDR(0)).toBe(`Rp${NB}0`);
    for (const n of [0, 1, 999, 1_000, 12_345, 9_999_999]) {
      expect(formatIDR(n)).not.toMatch(/[,.]\d{2}$/);
    }
  });

  it("handles the 9-digit amounts the layout was stress-tested against", () => {
    expect(formatIDR(125_000_000)).toBe(`Rp${NB}125.000.000`);
    expect(formatIDR(1_000_000_000)).toBe(`Rp${NB}1.000.000.000`);
  });

  it("formats negatives without losing the sign", () => {
    expect(formatIDR(-50_000)).toContain("50.000");
    expect(formatIDR(-50_000)).toMatch(/-/);
  });
});

describe("formatGrouped", () => {
  it("groups digits with no currency symbol", () => {
    expect(formatGrouped(1_250_000)).toBe("1.250.000");
    expect(formatGrouped(0)).toBe("0");
    expect(formatGrouped(999)).toBe("999");
  });
});

describe("formatCompactIDR", () => {
  it("uses Indonesian short scale with a comma decimal", () => {
    expect(formatCompactIDR(250_000)).toBe("250 rb");
    expect(formatCompactIDR(1_500_000)).toBe("1,5 jt");
    expect(formatCompactIDR(2_400_000_000)).toBe("2,4 M");
  });

  it("leaves values under a thousand bare", () => {
    expect(formatCompactIDR(0)).toBe("0");
    expect(formatCompactIDR(999)).toBe("999");
  });

  it("switches unit exactly at each boundary", () => {
    expect(formatCompactIDR(1_000)).toBe("1 rb");
    expect(formatCompactIDR(999_999)).toBe("1.000 rb");
    expect(formatCompactIDR(1_000_000)).toBe("1 jt");
    expect(formatCompactIDR(1_000_000_000)).toBe("1 M");
  });

  it("keeps the sign on negatives", () => {
    expect(formatCompactIDR(-1_500_000)).toBe("-1,5 jt");
    expect(formatCompactIDR(-250_000)).toBe("-250 rb");
  });

  it("rounds to at most one decimal place", () => {
    expect(formatCompactIDR(1_234_567)).toBe("1,2 jt");
  });
});

describe("parseIDR", () => {
  it("accepts every shape a user might type or paste", () => {
    expect(parseIDR("Rp 1.250.000")).toBe(1_250_000);
    expect(parseIDR("1250000")).toBe(1_250_000);
    expect(parseIDR("1,250,000")).toBe(1_250_000);
    expect(parseIDR(`Rp${NB}1.250.000`)).toBe(1_250_000);
  });

  it("returns 0 for empty or non-numeric input", () => {
    expect(parseIDR("")).toBe(0);
    expect(parseIDR("abc")).toBe(0);
    expect(parseIDR("Rp")).toBe(0);
  });

  it("round-trips with formatGrouped", () => {
    for (const n of [0, 1, 1_000, 15_000, 1_250_000, 125_000_000]) {
      expect(parseIDR(formatGrouped(n))).toBe(n);
    }
  });

  it("round-trips with formatIDR, non-breaking space included", () => {
    for (const n of [1_000, 250_000, 125_000_000]) {
      expect(parseIDR(formatIDR(n))).toBe(n);
    }
  });

  it("strips a minus sign rather than producing a negative amount", () => {
    // Amounts are always stored positive; direction comes from `kind`.
    expect(parseIDR("-50000")).toBe(50_000);
  });
});

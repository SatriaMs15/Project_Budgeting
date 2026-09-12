import { describe, it, expect } from "vitest";
import {
  formatIDR,
  formatGrouped,
  formatCompactIDR,
  parseIDR,
} from "@/lib/format";

/**
 * Intl puts a NON-BREAKING space after "Rp" — true under the old id-ID locale
 * and still true under en-GB with currencyDisplay:"narrowSymbol". Asserting a
 * plain space here would fail, and any code that string-matches the output
 * needs to know this too.
 */
const NB = "\u00a0";

/**
 * The assertions below are LOCALE-SPECIFIC. lib/locale.ts is set to en-GB, so
 * thousands group with commas and the decimal mark is a dot. Switching that
 * constant to "en-ID" (English words, Rupiah digit grouping) makes this file
 * the one that has to change: "1,250,000" becomes "1,250,000" and "1.5M"
 * becomes "1,5M". Nothing here is testing Intl itself — the point is to pin
 * the shape the rest of the app and its tests string-match against.
 */

describe("formatIDR", () => {
  it("groups with commas and prefixes Rp", () => {
    expect(formatIDR(1_250_000)).toBe(`Rp${NB}1,250,000`);
  });

  it("uses the Rp mark, not the IDR code", () => {
    // The plain `symbol` display renders "IDR" under an English locale, which
    // is why the formatter asks for narrowSymbol.
    expect(formatIDR(1_000)).toContain("Rp");
    expect(formatIDR(1_000)).not.toContain("IDR");
  });

  it("never shows decimals — IDR has no minor unit", () => {
    expect(formatIDR(1500)).toBe(`Rp${NB}1,500`);
    expect(formatIDR(1)).toBe(`Rp${NB}1`);
    expect(formatIDR(0)).toBe(`Rp${NB}0`);
    for (const n of [0, 1, 999, 1_000, 12_345, 9_999_999]) {
      expect(formatIDR(n)).not.toMatch(/[,.]\d{2}$/);
    }
  });

  it("handles the 9-digit amounts the layout was stress-tested against", () => {
    expect(formatIDR(125_000_000)).toBe(`Rp${NB}125,000,000`);
    expect(formatIDR(1_000_000_000)).toBe(`Rp${NB}1,000,000,000`);
  });

  it("formats negatives without losing the sign", () => {
    expect(formatIDR(-50_000)).toContain("50,000");
    expect(formatIDR(-50_000)).toMatch(/-/);
  });
});

describe("formatGrouped", () => {
  it("groups digits with no currency symbol", () => {
    expect(formatGrouped(1_250_000)).toBe("1,250,000");
    expect(formatGrouped(0)).toBe("0");
    expect(formatGrouped(999)).toBe("999");
  });
});

describe("formatCompactIDR", () => {
  it("uses the English short scale with a dot decimal", () => {
    expect(formatCompactIDR(250_000)).toBe("250K");
    expect(formatCompactIDR(1_500_000)).toBe("1.5M");
    expect(formatCompactIDR(2_400_000_000)).toBe("2.4B");
  });

  it("reads M as a million, not the Indonesian miliar it used to mean", () => {
    // The old scale was rb/jt/M, where M was a THOUSAND million. Anyone
    // string-matching these labels, or reading an old screenshot, needs the
    // boundary to be unambiguous.
    expect(formatCompactIDR(1_000_000)).toBe("1M");
    expect(formatCompactIDR(1_000_000_000)).toBe("1B");
  });

  it("leaves values under a thousand bare", () => {
    expect(formatCompactIDR(0)).toBe("0");
    expect(formatCompactIDR(999)).toBe("999");
  });

  it("switches unit exactly at each boundary", () => {
    expect(formatCompactIDR(1_000)).toBe("1K");
    expect(formatCompactIDR(999_999)).toBe("1,000K");
    expect(formatCompactIDR(1_000_000)).toBe("1M");
    expect(formatCompactIDR(1_000_000_000)).toBe("1B");
  });

  it("keeps the sign on negatives", () => {
    expect(formatCompactIDR(-1_500_000)).toBe("-1.5M");
    expect(formatCompactIDR(-250_000)).toBe("-250K");
  });

  it("rounds to at most one decimal place", () => {
    expect(formatCompactIDR(1_234_567)).toBe("1.2M");
  });

  it("never emits a separator that means the opposite elsewhere", () => {
    // A compact "1.5M" next to a grouped "1,250,000" is only safe because both
    // follow one convention: dot decimal, comma thousands. If lib/locale.ts is
    // switched to en-ID, both flip together — they must never disagree.
    const grouped = formatGrouped(1_250_000);
    const compact = formatCompactIDR(1_500_000);
    const groupSep = grouped.includes(",") ? "," : ".";
    const decimalSep = compact.includes(".") ? "." : ",";
    expect(decimalSep).not.toBe(groupSep);
  });
});

describe("parseIDR", () => {
  it("accepts every shape a user might type or paste", () => {
    // Both conventions are accepted on input, so an amount copied from
    // anywhere still lands correctly whichever locale the UI is set to.
    expect(parseIDR("Rp 1,250,000")).toBe(1_250_000);
    expect(parseIDR("Rp 1,250,000")).toBe(1_250_000);
    expect(parseIDR("1250000")).toBe(1_250_000);
    expect(parseIDR(`Rp${NB}1,250,000`)).toBe(1_250_000);
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

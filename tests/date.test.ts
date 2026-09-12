import { describe, it, expect } from "vitest";
import { monthStart, nextMonthStart, monthLabel, today } from "@/lib/date";

describe("monthStart", () => {
  it("returns the first of the given month, zero-padded", () => {
    expect(monthStart(new Date(2026, 8, 12))).toBe("2026-09-01");
    expect(monthStart(new Date(2026, 0, 31))).toBe("2026-01-01");
  });

  it("pads single-digit months", () => {
    expect(monthStart(new Date(2026, 2, 5))).toBe("2026-03-01");
  });
});

describe("nextMonthStart", () => {
  it("returns the first of the following month", () => {
    expect(nextMonthStart(new Date(2026, 8, 12))).toBe("2026-10-01");
  });

  it("rolls the year over at December", () => {
    expect(nextMonthStart(new Date(2026, 11, 25))).toBe("2027-01-01");
  });

  it("is always a strictly greater string than monthStart", () => {
    // The pages use these as a half-open range via string comparison, so
    // lexicographic order has to match chronological order.
    for (let m = 0; m < 12; m++) {
      const d = new Date(2026, m, 15);
      expect(nextMonthStart(d) > monthStart(d)).toBe(true);
    }
  });

  it("spans exactly one month with no gap", () => {
    for (let m = 0; m < 11; m++) {
      expect(nextMonthStart(new Date(2026, m, 1))).toBe(
        monthStart(new Date(2026, m + 1, 1)),
      );
    }
  });
});

describe("monthLabel", () => {
  it("renders an Indonesian long month and year", () => {
    expect(monthLabel(new Date(2026, 8, 12))).toBe("September 2026");
    expect(monthLabel(new Date(2026, 6, 1))).toBe("Juli 2026");
  });
});

describe("today", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(today(new Date(2026, 8, 5))).toBe("2026-09-05");
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses local time, not UTC", () => {
    // A late-evening local date must not roll back a day via toISOString().
    const lateLocal = new Date(2026, 8, 12, 23, 30);
    expect(today(lateLocal)).toBe("2026-09-12");
  });
});

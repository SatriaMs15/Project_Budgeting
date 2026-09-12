import { describe, it, expect } from "vitest";
import {
  monthStart,
  nextMonthStart,
  monthLabel,
  today,
  isValidDateString,
} from "@/lib/date";

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
  it("renders an English long month and year", () => {
    expect(monthLabel(new Date(2026, 8, 12))).toBe("September 2026");
    expect(monthLabel(new Date(2026, 6, 1))).toBe("July 2026");
  });

  it("uses English for the months that used to give it away", () => {
    // These four are where the half-translated UI showed: Mei, Agu, Okt, Des.
    expect(monthLabel(new Date(2026, 4, 1))).toBe("May 2026");
    expect(monthLabel(new Date(2026, 7, 1))).toBe("August 2026");
    expect(monthLabel(new Date(2026, 9, 1))).toBe("October 2026");
    expect(monthLabel(new Date(2026, 11, 1))).toBe("December 2026");
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

describe("isValidDateString", () => {
  it("accepts a real date", () => {
    expect(isValidDateString("2026-09-12")).toBe(true);
    expect(isValidDateString("2026-01-01")).toBe(true);
    expect(isValidDateString("2026-12-31")).toBe(true);
  });

  it("accepts a leap day in a leap year", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
  });

  it("rejects a leap day in a non-leap year", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
  });

  it("rejects days past the end of a month", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-04-31")).toBe(false);
    expect(isValidDateString("2026-06-31")).toBe(false);
  });

  it("rejects an impossible month or day", () => {
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-00-10")).toBe(false);
    expect(isValidDateString("2026-09-00")).toBe(false);
    expect(isValidDateString("2026-09-32")).toBe(false);
  });

  it("rejects anything not in YYYY-MM-DD form", () => {
    for (const bad of [
      "not-a-date",
      "",
      "2026-9-5",
      "12/09/2026",
      "2026-09-12T00:00:00Z",
      "20260912",
      " 2026-09-12",
    ]) {
      expect(isValidDateString(bad)).toBe(false);
    }
  });

  it("agrees with the helpers that produce dates", () => {
    expect(isValidDateString(today())).toBe(true);
    expect(isValidDateString(monthStart())).toBe(true);
    expect(isValidDateString(nextMonthStart())).toBe(true);
  });
});

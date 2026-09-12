import { LOCALE } from "@/lib/locale";

/** Date helpers for month-scoped budgeting (all in the user's local time). */

/** First day of the given month as "YYYY-MM-01". */
export function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** First day of the following month as "YYYY-MM-01" (exclusive upper bound). */
export function nextMonthStart(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  return m === 11
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 2).padStart(2, "0")}-01`;
}

/** Human label like "July 2026". */
export function monthLabel(d = new Date()): string {
  return d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
}

/** Today as "YYYY-MM-DD" in local time. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * True for a real calendar date written as YYYY-MM-DD.
 *
 * Rejects both malformed strings and impossible dates ("2026-02-30"), so a bad
 * value is caught with a readable message instead of reaching Postgres and
 * coming back as `invalid input syntax for type date`.
 */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-tripping catches month-length overflow (e.g. 31 April, 30 February).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

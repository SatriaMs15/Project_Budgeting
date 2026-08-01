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

/** Human label like "Juli 2026". */
export function monthLabel(d = new Date()): string {
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Today as "YYYY-MM-DD" in local time. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

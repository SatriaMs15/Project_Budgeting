/**
 * IDR (Indonesian Rupiah) helpers.
 *
 * Money is stored everywhere as an integer number of whole rupiah
 * (Rp 50.000 -> 50000). IDR has no minor unit, so we never use decimals
 * or floats for amounts.
 */

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const groupFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/** Format whole rupiah for display: 1250000 -> "Rp 1.250.000". */
export function formatIDR(amount: number): string {
  return idrFormatter.format(amount);
}

/** Group digits without the currency symbol: 1250000 -> "1.250.000". */
export function formatGrouped(amount: number): string {
  return groupFormatter.format(amount);
}

/**
 * Compact rupiah for chart axes: 1_500_000 -> "1,5 jt", 250_000 -> "250 rb".
 * Uses Indonesian short scale (rb = ribu, jt = juta, M = miliar).
 */
export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const one = (n: number) =>
    n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sign}${one(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}${one(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}${one(abs / 1_000)} rb`;
  return `${sign}${abs}`;
}

/**
 * Parse user input into whole rupiah. Strips everything except digits,
 * so "Rp 1.250.000", "1250000", and "1,250,000" all -> 1250000.
 * Returns 0 for empty / non-numeric input.
 */
export function parseIDR(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

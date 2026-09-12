/**
 * IDR (Indonesian Rupiah) helpers.
 *
 * Money is stored everywhere as an integer number of whole rupiah
 * (Rp 50,000 -> 50000). IDR has no minor unit, so we never use decimals
 * or floats for amounts.
 */

import { LOCALE } from "@/lib/locale";

// narrowSymbol keeps the "Rp" mark; the plain symbol form renders "IDR" under
// an English locale. The space it emits is U+00A0, as it was under id-ID.
const idrFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  currencyDisplay: "narrowSymbol",
});

const groupFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

/** Format whole rupiah for display: 1250000 -> "Rp 1,250,000". */
export function formatIDR(amount: number): string {
  return idrFormatter.format(amount);
}

/** Group digits without the currency symbol: 1250000 -> "1,250,000". */
export function formatGrouped(amount: number): string {
  return groupFormatter.format(amount);
}

/**
 * Compact rupiah for chart axes: 1_500_000 -> "1.5M", 250_000 -> "250K".
 *
 * NOTE: "M" changed meaning. It was the Indonesian short scale (rb = ribu,
 * jt = juta, M = miliar), where M was a THOUSAND million. On the English scale
 * M is a million and B is a thousand million, so an axis that used to read
 * "1 M" for a billion now reads "1B". Anyone used to the old labels should
 * read them afresh.
 */
export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const one = (n: number) =>
    n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sign}${one(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${one(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${one(abs / 1_000)}K`;
  return `${sign}${abs}`;
}

/**
 * Parse user input into whole rupiah. Strips everything except digits,
 * so "Rp 1,250,000", "1250000", and "1.250.000" all -> 1250000, which keeps
 * amounts typed in either convention working.
 * Returns 0 for empty / non-numeric input.
 */
export function parseIDR(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

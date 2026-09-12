/**
 * The one locale the whole UI formats against.
 *
 * The app had been half-translated: English labels next to `id-ID` dates and
 * numbers, so a month rendered "Mei" and "Agu" under English headings. It is
 * now English throughout, with amounts still in Rupiah.
 *
 * `en-GB` rather than `en-US` because it keeps the day-first date order the app
 * already had ("12 Sept 2026"), which is also what Indonesian readers expect —
 * only the month names change.
 *
 * ── The one judgement call here ───────────────────────────────────────────
 * This also switches digit grouping: `Rp 1.250.000` becomes `Rp 1,250,000`.
 *
 * That is a deliberate override of an earlier decision to keep the Indonesian
 * format, and the reason is that the two halves cannot be mixed safely. In
 * Indonesian a dot groups thousands; in English it is the decimal point. Left
 * as-is, an English reader sees "Rp 1.250.000" as one and a quarter rupiah —
 * and the chart axes are worse, because a compact "1.5M" alongside a grouped
 * "1.250.000" gives the same character two opposite meanings on one screen.
 * Picking one convention and applying it everywhere is the only version that
 * cannot be misread.
 *
 * To keep Rupiah formatting instead — `Rp 1.250.000`, English words — change
 * this to "en-ID". That locale pairs English month names with Indonesian digit
 * grouping, and every formatter in lib/format.ts and lib/date.ts follows it.
 * Nothing else needs editing; the tests in tests/format.test.ts state which
 * assertions are locale-specific.
 */
export const LOCALE = "en-GB";

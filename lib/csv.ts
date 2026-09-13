/**
 * Deterministic CSV → transaction parsing. This is the always-works, $0
 * fallback used when no AI key is configured (or the AI call fails on a CSV):
 * it reads common bank-export shapes without calling any model.
 *
 * Amounts come out as whole rupiah (see lib/format). We never trust the model
 * or the file for sign alone — debit/credit columns win when present.
 */

import type { Kind } from "@/lib/supabase/types";

export type ProposedRow = {
  occurred_on: string; // YYYY-MM-DD
  note: string;
  amount: number; // whole rupiah, always positive
  kind: Kind;
  suggested_category: string; // best-match category name, or "" if unknown
};

/** Split one CSV line honouring double-quoted fields. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Pick the delimiter that yields the most columns on the header row. */
function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const n = splitLine(headerLine, d).length;
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }
  return best;
}

/** Find the first header index whose name contains any of the keywords. */
function findColumn(headers: string[], keywords: string[]): number {
  return headers.findIndex((h) =>
    keywords.some((k) => h.toLowerCase().includes(k)),
  );
}

/** Whole rupiah from a money-ish string. Returns { value, negative }. */
function parseAmount(raw: string): { value: number; negative: boolean } {
  const negative = /^\(.*\)$/.test(raw.trim()) || raw.trim().startsWith("-");
  const digits = raw.replace(/[^\d]/g, "");
  return { value: digits ? parseInt(digits, 10) : 0, negative };
}

/** Best-effort date → YYYY-MM-DD. Assumes day-first for ambiguous DD/MM/YYYY. */
function parseDate(raw: string): string {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const [, d, m, rawYear] = dmy;
    const y = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parse CSV text into proposed transactions. Recognises either a single
 * signed "amount" column or separate debit/credit columns, plus a date and a
 * description column, under a range of English/Indonesian header names.
 * Rows without a usable amount are skipped.
 *
 * A "type" and a "category" column are used when present — which is how the
 * downloadable template carries information a bank export cannot. Without
 * them, direction is inferred from the sign and every row arrives
 * uncategorised, which is what any ordinary statement gives us.
 *
 * `knownCategories` is matched case-insensitively; a name that is not on the
 * list is dropped rather than guessed at, so the review screen shows it as
 * Uncategorized instead of quietly filing it somewhere wrong.
 */
export function parseCsvTransactions(
  text: string,
  knownCategories: string[] = [],
): ProposedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);

  const dateCol = findColumn(headers, ["date", "tanggal", "tgl", "waktu"]);
  const descCol = findColumn(headers, [
    "desc",
    "keterangan",
    "narrative",
    "memo",
    "note",
    "catatan",
    "uraian",
    "detail",
  ]);
  const amountCol = findColumn(headers, ["amount", "jumlah", "nominal", "value"]);
  const debitCol = findColumn(headers, ["debit", "debet", "keluar"]);
  const creditCol = findColumn(headers, ["credit", "kredit", "masuk"]);
  const typeCol = findColumn(headers, ["type", "kind", "jenis", "arah"]);
  const categoryCol = findColumn(headers, ["category", "kategori"]);

  const byName = new Map(knownCategories.map((n) => [n.trim().toLowerCase(), n]));

  const rows: ProposedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const at = (idx: number) => (idx >= 0 ? (cells[idx] ?? "") : "");

    let amount = 0;
    let kind: Kind = "expense";

    if (debitCol >= 0 || creditCol >= 0) {
      const debit = parseAmount(at(debitCol)).value;
      const credit = parseAmount(at(creditCol)).value;
      if (credit > 0) {
        amount = credit;
        kind = "income";
      } else if (debit > 0) {
        amount = debit;
        kind = "expense";
      }
    } else if (amountCol >= 0) {
      const { value, negative } = parseAmount(at(amountCol));
      amount = value;
      kind = negative ? "expense" : "income";
    }

    // An explicit type column beats anything inferred from a sign.
    if (typeCol >= 0) {
      const stated = at(typeCol).trim().toLowerCase();
      if (stated.startsWith("income") || stated === "masuk" || stated === "pemasukan") {
        kind = "income";
      } else if (
        stated.startsWith("expense") ||
        stated === "keluar" ||
        stated === "pengeluaran"
      ) {
        kind = "expense";
      }
    }

    if (amount <= 0) continue;

    rows.push({
      occurred_on: parseDate(at(dateCol)),
      note: at(descCol),
      amount,
      kind,
      suggested_category:
        categoryCol >= 0
          ? (byName.get(at(categoryCol).trim().toLowerCase()) ?? "")
          : "",
    });
  }
  return rows;
}

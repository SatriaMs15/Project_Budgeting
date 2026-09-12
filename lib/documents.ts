/**
 * Turning uploaded Office documents into something the CSV parser can read.
 *
 * The point is to keep XLSX and DOCX on the deterministic, $0 path wherever
 * possible instead of spending an AI call on them. Both formats usually hold a
 * plain table, and lib/csv.ts already knows how to read a table — it just needs
 * one delivered as text. Only when no table yields rows does the caller fall
 * back to the model.
 *
 * Nothing here talks to the database or the network; it is all pure
 * transformation, which is what makes it testable without fixtures.
 */

import ExcelJS from "exceljs";
import mammoth from "mammoth";

export type UploadKind = "csv" | "xlsx" | "docx" | "other";

/**
 * What kind of upload this is.
 *
 * Extension first, because browsers are unreliable about Office MIME types —
 * a .xlsx often arrives as application/octet-stream, and on some systems as
 * application/zip, which is technically true and completely unhelpful.
 */
export function classifyUpload(name: string, type = ""): UploadKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || type.includes("csv")) return "csv";
  if (ext === "xlsx" || ext === "xlsm") return "xlsx";
  if (ext === "docx") return "docx";
  if (type.includes("spreadsheetml")) return "xlsx";
  if (type.includes("wordprocessingml")) return "docx";
  return "other";
}

/* ── CSV assembly ────────────────────────────────────────────────────────── */

/** Quote a field only when it would otherwise break the row. */
function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: string[][]): string {
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => r.map(csvField).join(","))
    .join("\n");
}

/* ── XLSX ────────────────────────────────────────────────────────────────── */

/**
 * Flatten one spreadsheet cell to text.
 *
 * ExcelJS hands back a small union rather than a string: real Dates for date
 * cells, `{ result }` for formulas, `{ richText }` for styled runs, and
 * `{ text }` for hyperlinks. Anything unhandled would stringify to
 * "[object Object]" and quietly poison a column.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map((r) => String((r as { text?: string }).text ?? "")).join("");
    }
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return String(v.text ?? "");
    if ("error" in v) return "";
    return "";
  }
  return String(value);
}

/**
 * One CSV per worksheet, in workbook order.
 *
 * They are returned separately rather than concatenated because a second
 * sheet's header row would land in the middle of the first sheet's data and
 * the parser reads the first line as the header. The caller tries each in turn,
 * which also handles the common "Summary" sheet sitting in front of the real
 * statement.
 */
export async function xlsxToCsvSheets(bytes: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);

  const sheets: string[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-based with a leading hole; drop it.
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellText));
    });
    const csv = toCsv(rows);
    if (csv) sheets.push(csv);
  });
  return sheets;
}

/* ── DOCX ────────────────────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

/**
 * Pull every `<table>` out of mammoth's HTML as its own CSV.
 *
 * Regex over HTML is normally a mistake; it is safe here because the input is
 * not arbitrary markup — it is mammoth's own generated output, which is a flat,
 * predictable `table/tr/td` shape with no attributes or nesting to trip over.
 */
export function tableHtmlToCsv(html: string): string[] {
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  const out: string[] = [];

  for (const [, body] of tables) {
    const rows: string[][] = [];
    for (const [, tr] of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        ([, cell]) =>
          decodeEntities(cell.replace(/<[^>]+>/g, " "))
            .replace(/\s+/g, " ")
            .trim(),
      );
      if (cells.length) rows.push(cells);
    }
    const csv = toCsv(rows);
    if (csv) out.push(csv);
  }
  return out;
}

/** One CSV per table in the document, in document order. */
export async function docxToCsvTables(bytes: Buffer): Promise<string[]> {
  const { value } = await mammoth.convertToHtml({ buffer: bytes });
  return tableHtmlToCsv(value);
}

/**
 * The document as plain prose, for the AI fallback.
 *
 * Note this is NOT a substitute for the table path: extractRawText flattens a
 * table into one cell per line, losing which cells belonged to the same row,
 * so a statement read this way has no recoverable structure.
 */
export async function docxToText(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value;
}

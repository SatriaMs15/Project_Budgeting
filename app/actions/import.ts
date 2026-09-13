"use server";

import { revalidatePath } from "next/cache";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromBase64,
  createPartFromText,
} from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import type { Kind } from "@/lib/supabase/types";
import { parseCsvTransactions, type ProposedRow } from "@/lib/csv";
import {
  classifyUpload,
  docxToCsvTables,
  docxToText,
  xlsxToCsvSheets,
  type UploadKind,
} from "@/lib/documents";
import { isValidDateString } from "@/lib/date";
import { humanizeAiError } from "@/lib/ai-errors";

// "…-latest" alias tracks the current free-tier Flash, so we don't churn model
// versions as Google retires older ones (2.5-flash is already gone for new keys).
const MODEL = "gemini-flash-latest";

export type ExtractState = {
  error?: string;
  notice?: string;
  rows?: ProposedRow[];
  /** True when the model produced the rows, so category suggestions were
   *  actually attempted and an empty one means low confidence. */
  aiUsed?: boolean;
  ts: number;
};

export type ImportState = { error?: string; ts: number };

/**
 * Tables an Office document offers up, each as CSV, in the order we should try
 * them. XLSX gives one per worksheet, DOCX one per table; the first that yields
 * transactions wins, which handles a "Summary" sheet sitting in front of the
 * real statement.
 */
async function tablesFrom(kind: UploadKind, bytes: Buffer): Promise<string[]> {
  if (kind === "xlsx") return xlsxToCsvSheets(bytes);
  if (kind === "docx") return docxToCsvTables(bytes);
  return [];
}

/** First table that parses into at least one transaction. */
function firstParsable(tables: string[], categoryNames: string[]): ProposedRow[] {
  for (const table of tables) {
    const rows = parseCsvTransactions(table, categoryNames);
    if (rows.length > 0) return rows;
  }
  return [];
}

/** Coerce whatever the model returned into clean ProposedRows. */
function normalizeRows(raw: unknown, categoryNames: string[]): ProposedRow[] {
  if (!Array.isArray(raw)) return [];
  const known = new Map(categoryNames.map((n) => [n.toLowerCase(), n]));
  const today = new Date().toISOString().slice(0, 10);

  const out: ProposedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    const amount = Math.abs(
      Math.round(Number(String(r.amount ?? "").replace(/[^\d.-]/g, ""))),
    );
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const kind: Kind = String(r.type ?? "").toLowerCase() === "income"
      ? "income"
      : "expense";

    const dateStr = String(r.date ?? "").trim();
    const occurred_on = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : today;

    const suggested = String(r.category ?? "").trim();
    const suggested_category = known.get(suggested.toLowerCase()) ?? "";

    out.push({
      occurred_on,
      note: String(r.description ?? "").trim(),
      amount,
      kind,
      suggested_category,
    });
  }
  return out;
}

/**
 * Read an uploaded report and propose a transaction list. This NEVER writes to
 * the database — it only extracts. The user reviews and confirms in the UI,
 * then importTransactions performs the insert.
 *
 * Three routes in, cheapest first:
 *   - CSV, XLSX and DOCX are read directly by lib/csv.ts. Free, instant, and
 *     works with no API key.
 *   - PDFs and photos go to Gemini as the original bytes, which it can read.
 *   - An Office file with no recognisable table falls back to Gemini as TEXT,
 *     since it cannot read the zipped XML those formats really are.
 * A failed AI call on a CSV drops back to the deterministic parser rather than
 * leaving the user stuck.
 */
export async function extractTransactions(
  _prev: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const ts = Date.now();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to import.", ts };
  }

  const supabase = await createClient();
  const categories = unwrap(
    await supabase.from("categories").select("name"),
    "load categories",
  );
  const categoryNames = categories.map((c) => c.name);

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = classifyUpload(file.name, file.type);
  const csv = kind === "csv";
  const apiKey = process.env.GEMINI_API_KEY;

  // XLSX and DOCX are usually just a table wearing a different file extension.
  // Read it directly before considering the model: it is free, instant, and
  // works with no API key at all.
  if (kind === "xlsx" || kind === "docx") {
    let tables: string[];
    try {
      tables = await tablesFrom(kind, bytes);
    } catch {
      return {
        error: `That ${kind === "xlsx" ? "spreadsheet" : "document"} couldn't be opened. It may be password-protected, or saved in the older ${kind === "xlsx" ? ".xls" : ".doc"} format, which isn't supported.`,
        ts,
      };
    }

    const rows = firstParsable(tables, categoryNames);
    if (rows.length > 0) {
      return {
        rows,
        notice: `Read the table directly from your ${kind === "xlsx" ? "spreadsheet" : "document"}. Set a category for each row below.`,
        aiUsed: false,
        ts,
      };
    }

    // No usable table. Hand the model text rather than the raw bytes — it
    // cannot read the zipped XML that .xlsx and .docx actually are.
    const text =
      kind === "docx" ? await docxToText(bytes) : tables.join("\n\n");
    if (!apiKey || !text.trim()) {
      return {
        error: `Couldn't find a transaction table in that ${kind === "xlsx" ? "spreadsheet" : "document"}. It needs a header row with date, amount (or debit/credit) and description columns.`,
        ts,
      };
    }
    return extractWithAi({ text }, categoryNames, ts);
  }

  // No AI key: deterministic CSV only.
  if (!apiKey) {
    if (!csv) {
      return {
        error:
          "AI import isn't configured (no GEMINI_API_KEY). Only CSV files can be imported for now.",
        ts,
      };
    }
    const rows = parseCsvTransactions(bytes.toString("utf8"), categoryNames);
    if (rows.length === 0) {
      return {
        error:
          "Couldn't find any transactions in that CSV. It needs date, amount (or debit/credit) and description columns.",
        ts,
      };
    }
    return {
      rows,
      notice:
        "Read directly from the CSV. Set a category for each row below.",
      aiUsed: false,
      ts,
    };
  }

  // AI path. apiKey is known to be set by here.
  return extractWithAi(
    { bytes, mimeType: file.type || "application/octet-stream" },
    categoryNames,
    ts,
    csv ? bytes.toString("utf8") : undefined,
  );
}

/**
 * Ask the model for transactions, from either the raw file or text we already
 * pulled out of it. `csvFallback` is the CSV source to reparse deterministically
 * if the call fails (quota, outage), so a CSV user is never left stuck.
 */
async function extractWithAi(
  input: { bytes?: Buffer; mimeType?: string; text?: string },
  categoryNames: string[],
  ts: number,
  csvFallback?: string,
): Promise<ExtractState> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "AI import isn't configured.", ts };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      `Extract every financial transaction from the attached document.\n` +
      `Return ONLY a JSON array. Each element must be an object with exactly:\n` +
      `- "date": the transaction date as "YYYY-MM-DD"\n` +
      `- "description": a short label (payee/merchant/memo)\n` +
      `- "amount": the value in whole Indonesian rupiah as a positive integer (no separators, no decimals)\n` +
      `- "type": "income" or "expense"\n` +
      `- "category": the best match from this list, or "" if none fit: ` +
      `${categoryNames.join(", ")}\n` +
      `Rules: skip opening/closing balances, subtotals and summary lines. ` +
      `Only include real transactions. If the document has no transactions, return [].`;

    const payload = input.text
      ? createPartFromText(input.text)
      : createPartFromBase64(
          (input.bytes as Buffer).toString("base64"),
          input.mimeType ?? "application/octet-stream",
        );
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([createPartFromText(prompt), payload]),
      config: { responseMimeType: "application/json" },
    });

    const text = response.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Occasionally the model wraps JSON in prose/fences — salvage the array.
      const match = text.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    const rows = normalizeRows(parsed, categoryNames);
    if (rows.length === 0) {
      return {
        error: "The AI didn't find any transactions in that file.",
        ts,
      };
    }
    return { rows, aiUsed: true, ts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // On failure (e.g. quota), still try to help CSV users deterministically.
    if (csvFallback !== undefined) {
      const rows = parseCsvTransactions(csvFallback, categoryNames);
      if (rows.length > 0) {
        return {
          rows,
          notice: `AI couldn't be used — ${humanizeAiError(message)}. Read the CSV directly instead; set categories below.`,
          ts,
        };
      }
    }
    return {
      error: `Couldn't read that file — ${humanizeAiError(message)}.`,
      ts,
    };
  }
}

/**
 * Insert the transactions the user confirmed on the review screen. Fields
 * arrive as parallel arrays (one entry per row, in DOM order).
 */
export async function importTransactions(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const ts = Date.now();
  const dates = formData.getAll("occurred_on").map(String);
  const notes = formData.getAll("note").map(String);
  const amounts = formData.getAll("amount").map((v) => Number(v));
  const kinds = formData.getAll("kind").map(String);
  const categoryIds = formData.getAll("category_id").map(String);

  const candidates = dates.map((occurred_on, i) => ({
    occurred_on,
    note: (notes[i] ?? "").trim(),
    amount: amounts[i],
    kind: kinds[i] as Kind,
    category_id: categoryIds[i] ? categoryIds[i] : null,
  }));

  const rows = candidates.filter(
    (r) =>
      Number.isInteger(r.amount) &&
      r.amount > 0 &&
      (r.kind === "income" || r.kind === "expense") &&
      (!r.occurred_on || isValidDateString(r.occurred_on)),
  );

  if (candidates.length === 0 || rows.length === 0) {
    return { error: "No valid rows to import.", ts };
  }

  // Never import a subset silently. The review screen promises a row count, so
  // a row that would be dropped has to be fixed or removed by the user first —
  // importing 3 of 4 and reporting success loses data without saying so.
  const dropped = candidates.length - rows.length;
  if (dropped > 0) {
    return {
      error:
        `${dropped} row${dropped === 1 ? " has" : "s have"} a missing or invalid ` +
        `amount, kind or date. Fix or remove ${dropped === 1 ? "it" : "them"} before importing.`,
      ts,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(
    rows.map((r) => ({
      amount: r.amount,
      kind: r.kind,
      category_id: r.category_id,
      note: r.note || null,
      occurred_on: r.occurred_on || undefined,
    })),
  );

  if (error) return { error: error.message, ts };

  revalidatePath("/transactions");
  revalidatePath("/");
  return { ts };
}

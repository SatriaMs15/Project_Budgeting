import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  buildImportTemplate,
  CATEGORY_SHEET,
  EXAMPLE_NOTE,
  TEMPLATE_HEADERS,
  TEMPLATE_SHEET,
} from "@/lib/import-template";
import { xlsxToCsvSheets } from "@/lib/documents";
import { parseCsvTransactions } from "@/lib/csv";
import type { Kind } from "@/lib/supabase/types";

const CATEGORIES: { name: string; kind: Kind }[] = [
  { name: "Bills", kind: "expense" },
  { name: "Food & Drink", kind: "expense" },
  { name: "Salary", kind: "income" },
];

async function open(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

describe("buildImportTemplate — shape", () => {
  it("produces a real workbook", async () => {
    const wb = await open(await buildImportTemplate(CATEGORIES));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      TEMPLATE_SHEET,
      CATEGORY_SHEET,
    ]);
  });

  it("puts the data sheet FIRST", async () => {
    // The importer takes the first sheet that yields transactions. If the
    // reference sheet came first and ever parsed, it would win.
    const wb = await open(await buildImportTemplate(CATEGORIES));
    expect(wb.worksheets[0].name).toBe(TEMPLATE_SHEET);
  });

  it("carries the documented headers in order", async () => {
    const wb = await open(await buildImportTemplate(CATEGORIES));
    const header = wb.getWorksheet(TEMPLATE_SHEET)!.getRow(1).values as string[];
    expect(header.slice(1)).toEqual([...TEMPLATE_HEADERS]);
  });

  it("lists the user's own categories for reference", async () => {
    const wb = await open(await buildImportTemplate(CATEGORIES));
    const sheet = wb.getWorksheet(CATEGORY_SHEET)!;
    const names: string[] = [];
    sheet.eachRow((row, i) => {
      if (i > 1) names.push(String(row.getCell(1).value));
    });
    expect(names).toEqual(["Bills", "Food & Drink", "Salary"]);
  });

  it("ships exactly one example row, captioned so it explains itself", async () => {
    // Counted by content, not rowCount: the dropdowns and number format are
    // applied down the sheet, which materialises empty rows behind them.
    const wb = await open(await buildImportTemplate(CATEGORIES));
    const sheet = wb.getWorksheet(TEMPLATE_SHEET)!;
    const filled: string[] = [];
    sheet.eachRow((row, i) => {
      if (i > 1 && row.getCell(2).value) filled.push(String(row.getCell(2).value));
    });
    expect(filled).toEqual([EXAMPLE_NOTE]);
  });

  it("stays small despite the pre-applied formatting", async () => {
    const buf = await buildImportTemplate(CATEGORIES);
    expect(buf.length).toBeLessThan(100_000);
  });

  it("offers a dropdown for Type and Category", async () => {
    const wb = await open(await buildImportTemplate(CATEGORIES));
    const sheet = wb.getWorksheet(TEMPLATE_SHEET)!;
    expect(sheet.getCell("D2").dataValidation?.type).toBe("list");
    expect(sheet.getCell("E2").dataValidation?.formulae?.[0]).toContain(
      CATEGORY_SHEET,
    );
  });

  it("survives an account with no categories at all", async () => {
    const wb = await open(await buildImportTemplate([]));
    expect(wb.getWorksheet(TEMPLATE_SHEET)).toBeDefined();
    // No list to point a dropdown at, so it must not emit a broken formula.
    expect(wb.getWorksheet(TEMPLATE_SHEET)!.getCell("E2").dataValidation)
      .toBeUndefined();
  });
});

describe("buildImportTemplate — the reference sheet cannot be mistaken for data", () => {
  it("yields no transactions on its own", async () => {
    // It has no date or amount column, so the importer skips past it.
    const [, categoriesCsv] = await xlsxToCsvSheets(
      await buildImportTemplate(CATEGORIES),
    );
    expect(parseCsvTransactions(categoriesCsv)).toHaveLength(0);
  });
});

describe("template round trip — download, fill, import", () => {
  /** Fill the template the way a user would: overwrite row 2, append more. */
  async function fill(rows: (string | number)[][]) {
    const wb = await open(await buildImportTemplate(CATEGORIES));
    const sheet = wb.getWorksheet(TEMPLATE_SHEET)!;
    sheet.spliceRows(2, 1); // drop the example
    for (const r of rows) sheet.addRow(r);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const names = CATEGORIES.map((c) => c.name);

  it("reads back exactly what was typed in", async () => {
    const buf = await fill([
      ["2026-09-01", "Kopi", 45000, "expense", "Food & Drink"],
      ["2026-09-02", "Gaji", 8500000, "income", "Salary"],
    ]);
    const [csv] = await xlsxToCsvSheets(buf);
    const rows = parseCsvTransactions(csv, names);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      occurred_on: "2026-09-01",
      note: "Kopi",
      amount: 45_000,
      kind: "expense",
      suggested_category: "Food & Drink",
    });
    expect(rows[1]).toMatchObject({
      kind: "income",
      suggested_category: "Salary",
    });
  });

  it("takes direction from the Type column, not the sign", async () => {
    // A positive number would otherwise read as income.
    const buf = await fill([["2026-09-01", "Kopi", 45000, "expense", "Bills"]]);
    const [csv] = await xlsxToCsvSheets(buf);
    expect(parseCsvTransactions(csv, names)[0].kind).toBe("expense");
  });

  it("matches a category however it was capitalised", async () => {
    const buf = await fill([["2026-09-01", "Kopi", 45000, "expense", "  food & DRINK "]]);
    const [csv] = await xlsxToCsvSheets(buf);
    expect(parseCsvTransactions(csv, names)[0].suggested_category).toBe(
      "Food & Drink",
    );
  });

  it("leaves an unknown category blank rather than guessing", async () => {
    const buf = await fill([["2026-09-01", "Kopi", 45000, "expense", "Groceries"]]);
    const [csv] = await xlsxToCsvSheets(buf);
    expect(parseCsvTransactions(csv, names)[0].suggested_category).toBe("");
  });

  it("accepts a row with Type and Category left empty", async () => {
    const buf = await fill([["2026-09-01", "Kopi", 45000, "", ""]]);
    const [csv] = await xlsxToCsvSheets(buf);
    const [row] = parseCsvTransactions(csv, names);
    expect(row.amount).toBe(45_000);
    expect(row.suggested_category).toBe("");
  });

  it("skips a row with no amount instead of importing a zero", async () => {
    const buf = await fill([
      ["2026-09-01", "Kopi", 45000, "expense", "Bills"],
      ["2026-09-02", "Forgot the amount", "", "expense", "Bills"],
    ]);
    const [csv] = await xlsxToCsvSheets(buf);
    expect(parseCsvTransactions(csv, names)).toHaveLength(1);
  });

  it("handles a description containing a comma", async () => {
    const buf = await fill([
      ["2026-09-01", "Kopi, roti, dan teh", 45000, "expense", "Bills"],
    ]);
    const [csv] = await xlsxToCsvSheets(buf);
    const [row] = parseCsvTransactions(csv, names);
    expect(row.note).toBe("Kopi, roti, dan teh");
    expect(row.amount).toBe(45_000);
  });

  it("imports the example row if it is left in, captioned as such", async () => {
    // Nothing is lost silently: it reaches the review screen saying what it is.
    const [csv] = await xlsxToCsvSheets(await buildImportTemplate(CATEGORIES));
    const rows = parseCsvTransactions(csv, names);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe(EXAMPLE_NOTE);
  });
});

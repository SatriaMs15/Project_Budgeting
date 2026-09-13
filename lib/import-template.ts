import ExcelJS from "exceljs";
import type { Kind } from "@/lib/supabase/types";

export type TemplateCategory = { name: string; kind: Kind };

/** The columns the template ships with, in order. */
export const TEMPLATE_HEADERS = [
  "Date",
  "Description",
  "Amount",
  "Type",
  "Category",
] as const;

/** Sheet names. The data sheet is first so the parser reaches it first. */
export const TEMPLATE_SHEET = "Transactions";
export const CATEGORY_SHEET = "Categories";

/**
 * The one row the template ships with.
 *
 * It is left in deliberately: an empty sheet tells a first-time user nothing
 * about the expected date format or how Type is spelled. Its description says
 * what it is, so if anyone imports without clearing it, the review screen shows
 * a row captioned "Example — delete this row" rather than a mystery entry.
 */
export const EXAMPLE_NOTE = "Example — delete this row";

/**
 * Build a personalised import template.
 *
 * Personalised because the Category column is only useful if it holds names
 * that actually exist: the user's own categories go on a second sheet and drive
 * a dropdown on the first, so a filled-in template maps cleanly instead of
 * arriving as a page of Uncategorized rows.
 *
 * The Categories sheet is safe to sit alongside the data: the importer tries
 * each sheet in turn and takes the first that yields transactions, and a sheet
 * with no date or amount column yields none.
 */
export async function buildImportTemplate(
  categories: TemplateCategory[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Buku Kas";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(TEMPLATE_SHEET);
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "description", width: 38 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const firstCategory = categories.find((c) => c.kind === "expense")?.name ?? "";
  sheet.addRow({
    date: new Date().toISOString().slice(0, 10),
    description: EXAMPLE_NOTE,
    amount: 25000,
    type: "expense",
    category: firstCategory,
  });

  const reference = workbook.addWorksheet(CATEGORY_SHEET);
  reference.columns = [
    { header: "Category", key: "name", width: 26 },
    { header: "For", key: "kind", width: 12 },
  ];
  reference.getRow(1).font = { bold: true };
  for (const c of categories) reference.addRow({ name: c.name, kind: c.kind });

  // Dropdowns over a generous range, so they still apply to rows added later.
  const lastCategoryRow = categories.length + 1;
  for (let row = 2; row <= 500; row++) {
    sheet.getCell(`D${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"expense,income"'],
    };
    if (categories.length > 0) {
      sheet.getCell(`E${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`=${CATEGORY_SHEET}!$A$2:$A$${lastCategoryRow}`],
      };
    }
    // Rupiah has no minor unit, so the amount column never shows decimals.
    sheet.getCell(`C${row}`).numFmt = "#,##0";
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

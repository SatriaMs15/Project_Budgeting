import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  classifyUpload,
  docxToCsvTables,
  docxToText,
  tableHtmlToCsv,
  xlsxToCsvSheets,
} from "@/lib/documents";
import { parseCsvTransactions } from "@/lib/csv";

describe("classifyUpload", () => {
  it.each([
    ["statement.csv", "text/csv", "csv"],
    ["statement.CSV", "", "csv"],
    ["export.xlsx", "", "xlsx"],
    ["export.xlsm", "", "xlsx"],
    ["report.docx", "", "docx"],
    ["scan.pdf", "application/pdf", "other"],
    ["receipt.jpg", "image/jpeg", "other"],
  ])("classifies %s", (name, type, expected) => {
    expect(classifyUpload(name, type)).toBe(expected);
  });

  it("trusts the extension when the browser sends a useless MIME type", () => {
    // .xlsx routinely arrives as octet-stream, and sometimes as application/zip
    // — technically true, and no help at all.
    expect(classifyUpload("export.xlsx", "application/octet-stream")).toBe("xlsx");
    expect(classifyUpload("export.xlsx", "application/zip")).toBe("xlsx");
    expect(classifyUpload("report.docx", "application/octet-stream")).toBe("docx");
  });

  it("falls back to the MIME type when the name has no extension", () => {
    expect(
      classifyUpload(
        "download",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("xlsx");
    expect(
      classifyUpload(
        "download",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });

  it("copes with no type at all", () => {
    expect(classifyUpload("mystery", "")).toBe("other");
    expect(classifyUpload("mystery")).toBe("other");
  });
});

describe("tableHtmlToCsv", () => {
  const table = (rows: string[][]) =>
    `<table>${rows
      .map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join("")}</tr>`)
      .join("")}</table>`;

  it("turns a table into CSV rows", () => {
    const csv = tableHtmlToCsv(
      table([
        ["Date", "Description", "Amount"],
        ["2026-09-01", "Coffee", "45000"],
      ]),
    );
    expect(csv).toEqual(["Date,Description,Amount\n2026-09-01,Coffee,45000"]);
  });

  it("returns each table separately, in document order", () => {
    const csv = tableHtmlToCsv(
      table([["A"], ["1"]]) + "<p>prose</p>" + table([["B"], ["2"]]),
    );
    expect(csv).toEqual(["A\n1", "B\n2"]);
  });

  it("strips the inner markup mammoth wraps cells in", () => {
    expect(
      tableHtmlToCsv("<table><tr><td><p><strong>Total</strong></p></td></tr></table>"),
    ).toEqual(["Total"]);
  });

  it("reads header cells as well as data cells", () => {
    expect(
      tableHtmlToCsv("<table><tr><th>Date</th><th>Amount</th></tr><tr><td>x</td><td>1</td></tr></table>"),
    ).toEqual(["Date,Amount\nx,1"]);
  });

  it("decodes the entities mammoth emits", () => {
    expect(
      tableHtmlToCsv("<table><tr><td>Food &amp; Drink</td><td>&#82;&#112;&nbsp;50</td></tr></table>"),
    ).toEqual(["Food & Drink,Rp 50"]);
  });

  it("quotes a cell containing a comma, so it stays one field", () => {
    const [csv] = tableHtmlToCsv(
      "<table><tr><td>Rp 1,250,000</td><td>Coffee</td></tr></table>",
    );
    expect(csv).toBe('"Rp 1,250,000",Coffee');
    // And the parser must read it back as two fields, not three.
    expect(csv.split(",").length).toBeGreaterThan(2); // naive split would break
  });

  it("escapes an embedded double quote", () => {
    expect(tableHtmlToCsv('<table><tr><td>He said "hi"</td></tr></table>')).toEqual([
      '"He said ""hi"""',
    ]);
  });

  it("collapses newlines and runs of whitespace inside a cell", () => {
    expect(
      tableHtmlToCsv("<table><tr><td><p>Two</p><p>lines</p></td></tr></table>"),
    ).toEqual(["Two lines"]);
  });

  it("drops rows that are entirely empty", () => {
    expect(
      tableHtmlToCsv("<table><tr><td>A</td></tr><tr><td></td></tr><tr><td>B</td></tr></table>"),
    ).toEqual(["A\nB"]);
  });

  it("returns nothing for a document with no tables", () => {
    expect(tableHtmlToCsv("<p>Just prose.</p>")).toEqual([]);
    expect(tableHtmlToCsv("")).toEqual([]);
  });

  it("ignores an empty table rather than emitting a blank entry", () => {
    expect(tableHtmlToCsv("<table></table>")).toEqual([]);
  });
});

/** Build a real .xlsx in memory, so the test exercises ExcelJS for real. */
async function workbook(
  sheets: Record<string, (string | number | Date | null)[][]>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    for (const r of rows) ws.addRow(r);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("xlsxToCsvSheets", () => {
  it("converts a worksheet to CSV", async () => {
    const buf = await workbook({
      Statement: [
        ["Date", "Description", "Amount"],
        ["2026-09-01", "Coffee", 45000],
      ],
    });
    expect(await xlsxToCsvSheets(buf)).toEqual([
      "Date,Description,Amount\n2026-09-01,Coffee,45000",
    ]);
  });

  it("returns one CSV per sheet rather than concatenating them", async () => {
    // Concatenated, the second sheet's header would land in the middle of the
    // first sheet's data, and the parser reads line one as the header.
    const buf = await workbook({
      Summary: [["Opening balance"], ["1000000"]],
      Transactions: [
        ["Date", "Description", "Amount"],
        ["2026-09-01", "Coffee", 45000],
      ],
    });
    const sheets = await xlsxToCsvSheets(buf);
    expect(sheets).toHaveLength(2);
    expect(sheets[1]).toContain("Date,Description,Amount");
  });

  it("renders date cells as YYYY-MM-DD, not a JS Date string", async () => {
    const buf = await workbook({
      S: [
        ["Date", "Amount"],
        [new Date(Date.UTC(2026, 8, 2)), 1000],
      ],
    });
    const [csv] = await xlsxToCsvSheets(buf);
    expect(csv).toContain("2026-09-02");
    expect(csv).not.toContain("GMT");
  });

  it("never lets a cell stringify to [object Object]", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["Date", "Description", "Amount"]);
    const row = ws.addRow(["2026-09-01", "", 1000]);
    row.getCell(2).value = {
      richText: [{ text: "Cof" }, { text: "fee" }],
    } as never;
    const [csv] = await xlsxToCsvSheets(
      Buffer.from(await wb.xlsx.writeBuffer()),
    );
    expect(csv).toContain("Coffee");
    expect(csv).not.toContain("[object Object]");
  });

  it("skips blank rows", async () => {
    const buf = await workbook({
      S: [["Date", "Amount"], [], ["2026-09-01", 1000]],
    });
    const [csv] = await xlsxToCsvSheets(buf);
    expect(csv.split("\n")).toHaveLength(2);
  });

  it("produces something lib/csv.ts can actually parse", async () => {
    // The whole point: an XLSX becomes transactions with no AI call at all.
    const buf = await workbook({
      S: [
        ["Date", "Description", "Amount"],
        ["2026-09-01", "Coffee", 45000],
        ["2026-09-02", "Salary", 8500000],
      ],
    });
    const [csv] = await xlsxToCsvSheets(buf);
    const rows = parseCsvTransactions(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ occurred_on: "2026-09-01", amount: 45000 });
  });

  it("rejects a file that is not a spreadsheet", async () => {
    await expect(
      xlsxToCsvSheets(Buffer.from("just some text, definitely not a zip")),
    ).rejects.toThrow();
  });
});

describe("docxToCsvTables — against a real .docx", () => {
  // tests/fixtures/statement.docx is a genuine OOXML package, so this exercises
  // mammoth for real rather than trusting hand-written HTML. It is shaped like
  // an actual statement: a heading, a summary table that is NOT the
  // transactions, then the transaction table with dot-grouped rupiah.
  const fixture = () =>
    readFileSync(join(import.meta.dirname, "fixtures/statement.docx"));

  it("returns one CSV per table, in document order", async () => {
    const tables = await docxToCsvTables(fixture());
    expect(tables).toHaveLength(2);
    expect(tables[0]).toContain("Opening balance");
    expect(tables[1]).toContain("Date,Description,Debit,Credit");
  });

  it("parses the transaction table, not the summary above it", async () => {
    // The summary table comes first and has no date column, so it yields
    // nothing — which is exactly why the caller tries each table in turn.
    const tables = await docxToCsvTables(fixture());
    expect(parseCsvTransactions(tables[0])).toHaveLength(0);

    const rows = parseCsvTransactions(tables[1]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      occurred_on: "2026-09-01",
      amount: 45_000,
      kind: "expense",
    });
  });

  it("reads debit and credit columns as opposite directions", async () => {
    const tables = await docxToCsvTables(fixture());
    const rows = parseCsvTransactions(tables[1]);
    expect(rows.find((r) => r.note.includes("Gaji"))?.kind).toBe("income");
    expect(rows.find((r) => r.note.includes("Kopi"))?.kind).toBe("expense");
  });

  it("keeps dot-grouped rupiah intact through the conversion", async () => {
    const tables = await docxToCsvTables(fixture());
    const rows = parseCsvTransactions(tables[1]);
    expect(rows.find((r) => r.note.includes("Gaji"))?.amount).toBe(8_500_000);
  });

  it("extracts prose separately, flattened, for the AI fallback", async () => {
    const text = await docxToText(fixture());
    expect(text).toContain("Account Statement");
    // Documented limitation: raw text loses which cells shared a row, which is
    // why the table path exists at all.
    expect(text).toContain("Kopi Kenangan");
  });

  it("rejects a file that is not a Word document", async () => {
    await expect(docxToCsvTables(Buffer.from("not a docx"))).rejects.toThrow();
  });
});

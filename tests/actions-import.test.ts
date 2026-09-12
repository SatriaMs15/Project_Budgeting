import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  createHarness,
  makeClient,
  multiForm,
  type HarnessState,
} from "./supabase-harness";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));

const { importTransactions, extractTransactions } = await import(
  "@/app/actions/import"
);

const prev = { ts: 0 };

beforeEach(() => {
  h.state = createHarness();
  delete process.env.GEMINI_API_KEY;
});

function row(over: Partial<Record<string, string>> = {}) {
  return {
    occurred_on: "2026-09-05",
    note: "Warung",
    amount: "25000",
    kind: "expense",
    category_id: "cat-1",
    ...over,
  };
}

describe("importTransactions — parallel arrays stay aligned", () => {
  it("maps each row's fields to the same row", async () => {
    await importTransactions(
      prev,
      multiForm([
        row({ note: "First", amount: "1000", occurred_on: "2026-09-01" }),
        row({ note: "Second", amount: "2000", occurred_on: "2026-09-02", kind: "income" }),
      ]),
    );

    const inserted = h.state.calls[0].payload as Record<string, unknown>[];
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      note: "First",
      amount: 1000,
      occurred_on: "2026-09-01",
      kind: "expense",
    });
    expect(inserted[1]).toMatchObject({
      note: "Second",
      amount: 2000,
      occurred_on: "2026-09-02",
      kind: "income",
    });
  });

  it("keeps rows in submitted order", async () => {
    await importTransactions(
      prev,
      multiForm([
        row({ amount: "100" }),
        row({ amount: "200" }),
        row({ amount: "300" }),
      ]),
    );
    const inserted = h.state.calls[0].payload as { amount: number }[];
    expect(inserted.map((r) => r.amount)).toEqual([100, 200, 300]);
  });
});

describe("importTransactions — per-row validation", () => {
  it.each([
    ["a zero amount", { amount: "0" }],
    ["an unusable kind", { kind: "unknown" }],
    ["a non-numeric amount", { amount: "abc" }],
    ["a malformed date", { occurred_on: "13/09/2026" }],
  ])("refuses the import when one row has %s", async (_label, bad) => {
    const r = await importTransactions(prev, multiForm([row(bad), row()]));

    expect(r.error).toMatch(/1 row has a missing or invalid/);
    // Nothing is written: a partial import would lose the bad row silently.
    expect(h.state.calls).toHaveLength(0);
  });

  it("refuses the whole import when nothing is valid", async () => {
    const r = await importTransactions(prev, multiForm([row({ amount: "0" })]));
    expect(r.error).toBe("No valid rows to import.");
    expect(h.state.calls).toHaveLength(0);
  });

  it("refuses an empty submission", async () => {
    const r = await importTransactions(prev, multiForm([]));
    expect(r.error).toBe("No valid rows to import.");
  });
});

describe("importTransactions — field handling", () => {
  it("stores a null note when blank", async () => {
    await importTransactions(prev, multiForm([row({ note: "   " })]));
    expect((h.state.calls[0].payload as Record<string, unknown>[])[0]).toMatchObject({
      note: null,
    });
  });

  it("stores a null category when uncategorised", async () => {
    await importTransactions(prev, multiForm([row({ category_id: "" })]));
    expect((h.state.calls[0].payload as Record<string, unknown>[])[0]).toMatchObject({
      category_id: null,
    });
  });

  it("handles a 9-digit amount", async () => {
    await importTransactions(prev, multiForm([row({ amount: "125000000" })]));
    expect((h.state.calls[0].payload as { amount: number }[])[0].amount).toBe(
      125_000_000,
    );
  });

  it("surfaces a database failure", async () => {
    h.state.errors["transactions.insert"] = { message: "denied" };
    const r = await importTransactions(prev, multiForm([row()]));
    expect(r.error).toBe("denied");
  });
});

describe("extractTransactions — file input", () => {
  it("refuses when no file is attached", async () => {
    const r = await extractTransactions(prev, multiForm([]));
    expect(r.error).toBe("Choose a file to import.");
  });

  it("refuses an empty file", async () => {
    const fd = new FormData();
    fd.set("file", new File([], "empty.csv", { type: "text/csv" }));
    const r = await extractTransactions(prev, fd);
    expect(r.error).toBe("Choose a file to import.");
  });

  it("parses a CSV deterministically when no AI key is set", async () => {
    const csv = "date,description,amount\n2026-09-01,Lunch,-25000";
    const fd = new FormData();
    fd.set("file", new File([csv], "statement.csv", { type: "text/csv" }));

    const r = await extractTransactions(prev, fd);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows![0]).toMatchObject({ amount: 25_000, kind: "expense" });
    expect(r.notice).toMatch(/directly from the CSV/i);
  });

  it("explains that non-CSV needs an AI key", async () => {
    const fd = new FormData();
    fd.set("file", new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" }));

    const r = await extractTransactions(prev, fd);
    expect(r.error).toMatch(/GEMINI_API_KEY/);
    expect(r.error).toMatch(/CSV/);
  });

  it("reports a CSV it cannot understand", async () => {
    const fd = new FormData();
    fd.set("file", new File(["nothing;useful\nhere;either"], "x.csv", { type: "text/csv" }));

    const r = await extractTransactions(prev, fd);
    expect(r.error).toMatch(/Couldn't find any transactions/);
  });

  it("recognises a CSV by extension when the MIME type is generic", async () => {
    const csv = "tanggal,keterangan,jumlah\n01/09/2026,Makan,-25000";
    const fd = new FormData();
    fd.set("file", new File([csv], "export.csv", { type: "application/octet-stream" }));

    const r = await extractTransactions(prev, fd);
    expect(r.rows).toHaveLength(1);
  });
});

describe("importTransactions — never imports a partial set", () => {
  it("refuses rather than silently dropping an invalid row", async () => {
    // The review screen promises "Import N transactions". Importing N-1 and
    // reporting success loses a row without telling anyone.
    const r = await importTransactions(
      prev,
      multiForm([row({ note: "good" }), row({ note: "bad", amount: "0" })]),
    );

    expect(r.error).toMatch(/1 row has a missing or invalid/);
    expect(h.state.calls).toHaveLength(0);
  });

  it("pluralises the complaint for several bad rows", async () => {
    const r = await importTransactions(
      prev,
      multiForm([row(), row({ amount: "0" }), row({ kind: "weird" })]),
    );
    expect(r.error).toMatch(/2 rows have a missing or invalid/);
    expect(r.error).toMatch(/remove them/);
  });

  it("rejects a row whose date is malformed", async () => {
    const r = await importTransactions(
      prev,
      multiForm([row(), row({ occurred_on: "not-a-date" })]),
    );
    expect(r.error).toMatch(/1 row has a missing or invalid/);
    expect(h.state.calls).toHaveLength(0);
  });

  it("imports the whole set when every row is valid", async () => {
    const r = await importTransactions(prev, multiForm([row(), row(), row()]));
    expect(r.error).toBeUndefined();
    expect(h.state.calls[0].payload).toHaveLength(3);
  });
});

describe("humanizeAiError", () => {
  it("never returns a raw JSON blob", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    const raw =
      '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}';
    const out = humanizeAiError(raw);
    expect(out).not.toContain("{");
    expect(out).not.toContain('"code"');
    expect(out).toBe("the AI service is busy right now");
  });

  it("recognises a quota failure", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    expect(humanizeAiError('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')).toBe(
      "the daily AI quota is used up",
    );
  });

  it("recognises a rejected key", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    expect(humanizeAiError("API_KEY_INVALID: bad key")).toBe(
      "the AI key was rejected",
    );
  });

  it("extracts the human sentence from an unrecognised JSON error", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    expect(
      humanizeAiError('{"error":{"code":400,"message":"Something specific went wrong"}}'),
    ).toBe("Something specific went wrong");
  });

  it("passes plain text through", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    expect(humanizeAiError("network timeout")).toBe("network timeout");
  });

  it("truncates a very long message rather than flooding the UI", async () => {
    const { humanizeAiError } = await import("@/lib/ai-errors");
    const out = humanizeAiError("x".repeat(500));
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("extractTransactions — aiUsed flag", () => {
  it("marks a deterministic CSV parse as not AI", async () => {
    const fd = new FormData();
    fd.set(
      "file",
      new File(["date,description,amount\n2026-09-01,Lunch,-25000"], "s.csv", {
        type: "text/csv",
      }),
    );
    const r = await extractTransactions(prev, fd);
    expect(r.aiUsed).toBe(false);
    expect(r.notice).not.toMatch(/\{/);
  });
});

describe("extractTransactions — Office documents without an AI key", () => {
  // The point of reading these directly: XLSX and DOCX are usually a table
  // wearing a different extension, so they should cost nothing and work with
  // no API key at all. GEMINI_API_KEY is deleted in beforeEach.

  async function xlsx(
    sheets: Record<string, (string | number)[][]>,
    name = "statement.xlsx",
    type = "",
  ) {
    const wb = new ExcelJS.Workbook();
    for (const [sheetName, rows] of Object.entries(sheets)) {
      const ws = wb.addWorksheet(sheetName);
      for (const r of rows) ws.addRow(r);
    }
    const fd = new FormData();
    fd.set("file", new File([await wb.xlsx.writeBuffer()], name, { type }));
    return fd;
  }

  function docx(name = "statement.docx") {
    const fd = new FormData();
    const bytes = readFileSync(join(import.meta.dirname, "fixtures/statement.docx"));
    fd.set("file", new File([bytes], name, { type: "" }));
    return fd;
  }

  it("reads a spreadsheet with no AI call", async () => {
    const r = await extractTransactions(
      prev,
      await xlsx({
        Statement: [
          ["Date", "Description", "Amount"],
          ["2026-09-01", "Kopi", -45000],
          ["2026-09-02", "Gaji", 8500000],
        ],
      }),
    );
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(2);
    expect(r.aiUsed).toBe(false);
    expect(r.notice).toMatch(/directly from your spreadsheet/i);
  });

  it("skips a summary sheet and finds the real statement", async () => {
    const r = await extractTransactions(
      prev,
      await xlsx({
        Summary: [["Opening balance"], ["12000000"]],
        Transactions: [
          ["Date", "Description", "Amount"],
          ["2026-09-01", "Kopi", -45000],
        ],
      }),
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows![0]).toMatchObject({ amount: 45_000, kind: "expense" });
  });

  it("reads a Word document with no AI call", async () => {
    const r = await extractTransactions(prev, docx());
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(3);
    expect(r.aiUsed).toBe(false);
    expect(r.notice).toMatch(/directly from your document/i);
  });

  it("picks the transaction table over the summary table above it", async () => {
    const r = await extractTransactions(prev, docx());
    expect(r.rows!.map((x) => x.amount)).toEqual([45_000, 8_500_000, 32_000]);
    expect(r.rows![1].kind).toBe("income");
  });

  it("recognises these by extension when the browser sends no MIME type", async () => {
    // .xlsx routinely arrives as octet-stream; going by MIME type alone would
    // send it to the model as unreadable zipped XML.
    const r = await extractTransactions(
      prev,
      await xlsx(
        { S: [["Date", "Description", "Amount"], ["2026-09-01", "Kopi", -45000]] },
        "export.xlsx",
        "application/octet-stream",
      ),
    );
    expect(r.rows).toHaveLength(1);
  });

  it("explains a spreadsheet it cannot open", async () => {
    const fd = new FormData();
    fd.set("file", new File(["definitely not a zip"], "broken.xlsx", { type: "" }));
    const r = await extractTransactions(prev, fd);
    expect(r.error).toMatch(/couldn't be opened/i);
    expect(r.error).toMatch(/\.xls\b/);
  });

  it("explains a spreadsheet with no transaction table", async () => {
    const r = await extractTransactions(
      prev,
      await xlsx({ Notes: [["Just"], ["some"], ["prose"]] }),
    );
    expect(r.error).toMatch(/Couldn't find a transaction table/i);
    expect(r.error).toMatch(/date, amount/i);
  });

  it("never reaches the AI for a table it can read itself", async () => {
    // A key being present must not change the cheap path.
    process.env.GEMINI_API_KEY = "test-key-should-not-be-used";
    const r = await extractTransactions(
      prev,
      await xlsx({
        S: [["Date", "Description", "Amount"], ["2026-09-01", "Kopi", -45000]],
      }),
    );
    expect(r.aiUsed).toBe(false);
    expect(r.rows).toHaveLength(1);
    delete process.env.GEMINI_API_KEY;
  });
});

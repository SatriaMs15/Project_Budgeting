import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import {
  createHarness,
  makeClient,
  type HarnessState,
} from "./supabase-harness";
import { CATEGORY_SHEET, TEMPLATE_SHEET } from "@/lib/import-template";

const h = vi.hoisted(() => ({ state: null as unknown as HarnessState }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(h.state),
}));
vi.mock("next/server", () => ({
  NextResponse: class {
    constructor(
      public body: unknown,
      public init: { headers: Record<string, string> },
    ) {}
    get headers() {
      return new Map(Object.entries(this.init.headers));
    }
  },
}));

const { GET } = await import("@/app/api/template/route");

beforeEach(() => {
  h.state = createHarness();
  h.state.data["categories"] = [
    { name: "Bills", kind: "expense" },
    { name: "Salary", kind: "income" },
  ];
});

const download = async () =>
  (await GET()) as unknown as {
    body: Buffer;
    headers: Map<string, string>;
  };

describe("GET /api/template", () => {
  it("returns a spreadsheet the browser will save", async () => {
    const r = await download();
    expect(r.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(r.headers.get("Content-Disposition")).toContain("attachment");
    expect(r.headers.get("Content-Disposition")).toContain(".xlsx");
  });

  it("never caches, since it is built per user", async () => {
    // A shared cache would hand one person's category list to another.
    const r = await download();
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("builds a workbook that actually opens", async () => {
    const r = await download();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      TEMPLATE_SHEET,
      CATEGORY_SHEET,
    ]);
  });

  it("fills the reference sheet from the caller's own categories", async () => {
    const r = await download();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.body as unknown as ArrayBuffer);
    const names: string[] = [];
    wb.getWorksheet(CATEGORY_SHEET)!.eachRow((row, i) => {
      if (i > 1) names.push(String(row.getCell(1).value));
    });
    expect(names).toEqual(["Bills", "Salary"]);
  });

  it("surfaces a failed category read instead of shipping an empty template", async () => {
    h.state.errors["categories"] = { message: "boom", code: "PGRST205" };
    await expect(GET()).rejects.toThrow(/Could not load categories/);
  });
});

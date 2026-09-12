import { describe, it, expect, vi, beforeEach } from "vitest";
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

import { describe, it, expect } from "vitest";
import { parseCsvTransactions } from "@/lib/csv";

describe("parseCsvTransactions — structure", () => {
  it("returns nothing for empty input or a header with no rows", () => {
    expect(parseCsvTransactions("")).toEqual([]);
    expect(parseCsvTransactions("date,amount")).toEqual([]);
  });

  it("skips rows with no usable amount", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,Nothing,\n2026-09-02,Real,50000",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("Real");
  });
});

describe("parseCsvTransactions — delimiters", () => {
  const cases: [string, string][] = [
    ["comma", ","],
    ["semicolon", ";"],
    ["tab", "\t"],
    ["pipe", "|"],
  ];

  for (const [name, d] of cases) {
    it(`detects a ${name}-delimited file`, () => {
      const csv = `date${d}description${d}amount\n2026-09-01${d}Lunch${d}-25000`;
      const rows = parseCsvTransactions(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].note).toBe("Lunch");
      expect(rows[0].amount).toBe(25_000);
    });
  }
});

describe("parseCsvTransactions — quoted fields", () => {
  it("keeps a delimiter that sits inside quotes", () => {
    const rows = parseCsvTransactions(
      'date,description,amount\n2026-09-01,"Coffee, milk and a bun",-30000',
    );
    expect(rows[0].note).toBe("Coffee, milk and a bun");
  });

  it("unescapes a doubled quote", () => {
    const rows = parseCsvTransactions(
      'date,description,amount\n2026-09-01,"He said ""hi""",-1000',
    );
    expect(rows[0].note).toBe('He said "hi"');
  });
});

describe("parseCsvTransactions — sign and direction", () => {
  it("reads a negative single amount column as an expense", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,Lunch,-25000",
    );
    expect(rows[0].kind).toBe("expense");
    expect(rows[0].amount).toBe(25_000); // always stored positive
  });

  it("reads a positive single amount column as income", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,Salary,8500000",
    );
    expect(rows[0].kind).toBe("income");
  });

  it("treats parenthesised accounting negatives as expenses", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,Rent,(2500000)",
    );
    expect(rows[0].kind).toBe("expense");
    expect(rows[0].amount).toBe(2_500_000);
  });

  it("lets debit/credit columns decide direction over any sign", () => {
    const rows = parseCsvTransactions(
      "date,description,debit,credit\n" +
        "2026-09-01,Groceries,150000,\n" +
        "2026-09-02,Payday,,8500000",
    );
    expect(rows[0].kind).toBe("expense");
    expect(rows[0].amount).toBe(150_000);
    expect(rows[1].kind).toBe("income");
    expect(rows[1].amount).toBe(8_500_000);
  });

  it("prefers credit when a row somehow has both", () => {
    const rows = parseCsvTransactions(
      "date,description,debit,credit\n2026-09-01,Odd,100,5000",
    );
    expect(rows[0].kind).toBe("income");
    expect(rows[0].amount).toBe(5_000);
  });
});

describe("parseCsvTransactions — Indonesian headers", () => {
  it("recognises tanggal/keterangan/jumlah", () => {
    const rows = parseCsvTransactions(
      "tanggal,keterangan,jumlah\n01/09/2026,Makan siang,-25000",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("Makan siang");
    expect(rows[0].occurred_on).toBe("2026-09-01");
  });

  it("recognises debet/kredit and masuk/keluar", () => {
    const a = parseCsvTransactions(
      "tanggal,uraian,debet,kredit\n01/09/2026,Sewa,2500000,",
    );
    expect(a[0].kind).toBe("expense");

    const b = parseCsvTransactions(
      "tgl,catatan,keluar,masuk\n01/09/2026,Gaji,,8500000",
    );
    expect(b[0].kind).toBe("income");
  });
});

describe("parseCsvTransactions — amounts", () => {
  it("strips thousand separators and currency symbols", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,Big,Rp 1.250.000",
    );
    expect(rows[0].amount).toBe(1_250_000);
  });

  it("reads dot-grouped amounts whatever the UI locale is set to", () => {
    // Imported files come from the user's bank, not from this app, so an
    // Indonesian export stays dot-grouped even though the UI now displays
    // "Rp 1,250,000". Parsing must not follow the display convention.
    const rows = parseCsvTransactions(
      'date,description,amount\n2026-09-01,Big,"Rp 1,250,000"',
    );
    expect(rows[0].amount).toBe(1_250_000);
  });

  it("handles 9-digit amounts without precision loss", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-09-01,House,125000000",
    );
    expect(rows[0].amount).toBe(125_000_000);
  });
});

describe("parseCsvTransactions — dates", () => {
  it("keeps ISO dates as-is and pads them", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n2026-9-5,X,1000",
    );
    expect(rows[0].occurred_on).toBe("2026-09-05");
  });

  it("reads ambiguous slash dates as day-first", () => {
    // 05/07/2026 is 5 July, not 7 May — the Indonesian reading.
    const rows = parseCsvTransactions(
      "date,description,amount\n05/07/2026,X,1000",
    );
    expect(rows[0].occurred_on).toBe("2026-07-05");
  });

  it("expands a two-digit year into the 2000s", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n05/07/26,X,1000",
    );
    expect(rows[0].occurred_on).toBe("2026-07-05");
  });

  it("falls back to a valid date for unparseable input", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n not a date ,X,1000",
    );
    expect(rows[0].occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseCsvTransactions — output contract", () => {
  it("always produces positive amounts and an empty category suggestion", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\n" +
        "2026-09-01,A,-25000\n" +
        "2026-09-02,B,8500000\n" +
        "2026-09-03,C,(1000)",
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.amount).toBeGreaterThan(0);
      expect(Number.isInteger(r.amount)).toBe(true);
      // The deterministic parser never guesses a category — the review screen
      // flags these as low confidence.
      expect(r.suggested_category).toBe("");
      expect(["income", "expense"]).toContain(r.kind);
    }
  });

  it("tolerates CRLF line endings and blank lines", () => {
    const rows = parseCsvTransactions(
      "date,description,amount\r\n2026-09-01,A,-1000\r\n\r\n2026-09-02,B,-2000\r\n",
    );
    expect(rows).toHaveLength(2);
  });
});

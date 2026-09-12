import { describe, it, expect } from "vitest";
import { CHART, moneyInk } from "@/lib/chart-colors";
import { categoryColor } from "@/lib/category-colors";

/* ── colour maths ──────────────────────────────────────────────────────── */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** sRGB channel -> linear light. */
function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Viénot/Brettel dichromat simulation in linear RGB. Good enough to assert
 * that two colours stay apart for the two common red-green deficiencies.
 */
const CVD_MATRIX = {
  protanopia: [
    [0.1121, 0.8853, -0.0005],
    [0.1127, 0.8897, -0.0001],
    [0.0045, 0.0, 1.0019],
  ],
  deuteranopia: [
    [0.292, 0.7054, -0.0003],
    [0.2934, 0.7089, 0.0001],
    [-0.0195, 0.0333, 0.9912],
  ],
} as const;

function simulate(hex: string, kind: keyof typeof CVD_MATRIX): [number, number, number] {
  const [r, g, b] = rgb(hex).map(lin);
  const m = CVD_MATRIX[kind];
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

/** Euclidean distance in simulated linear-RGB space. */
function cvdDistance(a: string, b: string, kind: keyof typeof CVD_MATRIX): number {
  const x = simulate(a, kind);
  const y = simulate(b, kind);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/* ── the invariants ────────────────────────────────────────────────────── */

const PAPER = "#f3f2f2"; // page ground
const CARD = "#ffffff"; // card surface

describe("the money pair is never red/green", () => {
  it("income is not a green hue and expense is not a red hue", () => {
    const [ir, ig, ib] = rgb(CHART.income);
    const [er, eg, eb] = rgb(CHART.expense);

    // Income is aqua: blue must be a real component, not a green-dominant hue.
    expect(ib).toBeGreaterThan(80);
    expect(ig).toBeGreaterThan(ir);

    // Expense is blue: blue dominates, and it is emphatically not red.
    expect(eb).toBeGreaterThan(er);
    expect(eb).toBeGreaterThan(eg);
    expect(er).toBeLessThan(100);
  });

  it("holds the exact hexes the design fixed", () => {
    expect(CHART.income).toBe("#1baf7a");
    expect(CHART.expense).toBe("#2a78d6");
  });
});

describe("the money pair survives colour-vision deficiency", () => {
  // A classic red/green pair collapses to nearly the same colour here; this
  // pair must not. The threshold is well above the ~0.02 a red/green pair scores.
  it.each(["protanopia", "deuteranopia"] as const)(
    "income and expense marks stay distinguishable under %s",
    (kind) => {
      expect(cvdDistance(CHART.income, CHART.expense, kind)).toBeGreaterThan(0.15);
    },
  );

  it.each(["protanopia", "deuteranopia"] as const)(
    "income and expense text inks stay distinguishable under %s",
    (kind) => {
      // Deepening for contrast must not collapse the pair together.
      expect(
        cvdDistance(CHART.incomeInk, CHART.expenseInk, kind),
      ).toBeGreaterThan(0.02);
    },
  );

  it("beats a naive red/green pair under both deficiencies", () => {
    for (const kind of ["protanopia", "deuteranopia"] as const) {
      const ours = cvdDistance(CHART.income, CHART.expense, kind);
      const naive = cvdDistance("#22c55e", "#ef4444", kind);
      expect(ours).toBeGreaterThan(naive);
    }
  });
});

describe("text inks are readable on the surfaces they sit on", () => {
  const textInks: [string, string][] = [
    ["income ink", CHART.incomeInk],
    ["expense ink", CHART.expenseInk],
    ["negative ink", CHART.negative],
    ["accent ink", CHART.accentInk],
  ];

  it.each(textInks)("%s clears 4.5:1 on the card surface", (_label, hex) => {
    expect(contrast(hex, CARD)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(textInks)("%s clears 4.5:1 on the page ground", (_label, hex) => {
    expect(contrast(hex, PAPER)).toBeGreaterThanOrEqual(4.5);
  });

  it("the deepened inks are what make money legible as text", () => {
    // The mark colours alone miss AA for normal text — that is exactly why the
    // design carries separate ink values. The handoff shipped this for income
    // but not for expense (#2a78d6 measures 4.42 on white, 3.95 on paper), so
    // expenseInk was added to match.
    expect(contrast(CHART.income, CARD)).toBeLessThan(4.5);
    expect(contrast(CHART.incomeInk, CARD)).toBeGreaterThanOrEqual(4.5);

    expect(contrast(CHART.expense, PAPER)).toBeLessThan(4.5);
    expect(contrast(CHART.expenseInk, PAPER)).toBeGreaterThanOrEqual(4.5);
  });

  it("each ink keeps the hue of the mark it deepens", () => {
    // A deepened ink must still read as the same colour, or the mark and the
    // figure beside it look like two different categories of money.
    const [, ig, ib] = rgb(CHART.incomeInk);
    expect(ig).toBeGreaterThan(ib); // still aqua-green leaning

    const [er, eg, eb] = rgb(CHART.expenseInk);
    expect(eb).toBeGreaterThan(eg);
    expect(eb).toBeGreaterThan(er); // still blue
  });

  it("body ink is comfortably above the minimum", () => {
    expect(contrast("#201f1d", CARD)).toBeGreaterThan(10);
  });
});

describe("moneyInk", () => {
  it("maps each kind to its readable ink", () => {
    expect(moneyInk("income")).toBe(CHART.incomeInk);
    expect(moneyInk("expense")).toBe(CHART.expenseInk);
  });

  it("never returns a lighter mark colour for text", () => {
    expect(moneyInk("income")).not.toBe(CHART.income);
    expect(moneyInk("expense")).not.toBe(CHART.expense);
  });
});

describe("categoryColor", () => {
  it("gives each named expense category its own mark", () => {
    const names = [
      "Food & Drink",
      "Transport",
      "Shopping",
      "Bills",
      "Entertainment",
      "Health",
      "Other",
    ];
    const colors = names.map((name) => categoryColor({ name, kind: "expense" }));
    expect(new Set(colors).size).toBe(names.length);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("matches by name regardless of case or padding", () => {
    const canonical = categoryColor({ name: "Food & Drink", kind: "expense" });
    expect(categoryColor({ name: "food & drink", kind: "expense" })).toBe(canonical);
    expect(categoryColor({ name: "  FOOD & DRINK  ", kind: "expense" })).toBe(canonical);
  });

  it("collapses every income category onto the income ink", () => {
    for (const name of ["Salary", "Bonus", "Other Income", "Freelance"]) {
      expect(categoryColor({ name, kind: "income" })).toBe(CHART.incomeInk);
    }
  });

  it("falls back to a neutral for unknown expense categories", () => {
    const c = categoryColor({ name: "Pet grooming", kind: "expense" });
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("survives a null or undefined category", () => {
    expect(categoryColor(null)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(categoryColor(undefined)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("every category mark is readable as tag text on a card", () => {
    // Category tags are outlined with the colour used as the label text too,
    // so each one has to carry contrast on its own.
    const names = [
      "Food & Drink",
      "Transport",
      "Shopping",
      "Bills",
      "Entertainment",
      "Health",
      "Other",
    ];
    for (const name of names) {
      const c = categoryColor({ name, kind: "expense" });
      expect(contrast(c, CARD)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

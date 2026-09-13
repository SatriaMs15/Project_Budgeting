/**
 * End-to-end for the import template: download it, fill it in the way a user
 * would, upload it, and check what reaches the review screen.
 *
 * This is the part unit tests cannot reach — the file really travels through
 * the browser, and the category names in it come from the live account rather
 * than a fixture.
 */

import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, test, summary, check, eq, ok, go, RUN } from "./harness.mjs";

const { browser, page } = await launch();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
page.on("response", (r) => {
  if (r.status() >= 500) errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
});

/** Download the template through the real link and return its bytes. */
async function downloadTemplate() {
  await go(page, "/import");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Download template/i }).click(),
  ]);
  const path = join(tmpdir(), `template-${RUN}-${Math.random().toString(36).slice(2)}.xlsx`);
  await download.saveAs(path);
  return { path, suggested: download.suggestedFilename() };
}

/** Fill the downloaded template and write it back, as a user would. */
async function fillTemplate(path, rows) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const sheet = wb.worksheets[0];
  sheet.spliceRows(2, 1); // remove the example row
  for (const r of rows) sheet.addRow(r);
  const out = path.replace(".xlsx", "-filled.xlsx");
  await wb.xlsx.writeFile(out);
  return out;
}

async function upload(path) {
  await go(page, "/import");
  await page.locator('input[type="file"]').setInputFiles(path);
  // "1 transaction found" is singular — the plural-only pattern this used to
  // wait for timed out on every single-row upload.
  await page
    .locator("text=/transactions? found|Couldn't|didn't find/i")
    .first()
    .waitFor({ timeout: 60_000 });
}

const reviewRows = () => page.locator('input[name="amount"]');

await test("the template box sits inside the upload area", async () => {
  await go(page, "/import");
  const dropzone = page.locator("form.border-dashed");
  eq("one dropzone", await dropzone.count(), 1);
  ok(
    "the download link is inside it",
    (await dropzone.getByRole("link", { name: /Download template/i }).count()) === 1,
  );
  ok(
    "the file input is inside it too",
    (await dropzone.locator('input[type="file"]').count()) === 1,
  );
});

await test("the template downloads as a named spreadsheet", async () => {
  const { path, suggested } = await downloadTemplate();
  ok("filename ends .xlsx", suggested.endsWith(".xlsx"));
  ok("named for the app", /buku-kas/i.test(suggested));
  ok("file has content", readFileSync(path).length > 1000);
});

await test("the template is built from this account's own categories", async () => {
  const { path } = await downloadTemplate();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const names = [];
  wb.getWorksheet("Categories").eachRow((row, i) => {
    if (i > 1) names.push(String(row.getCell(1).value));
  });
  ok("lists categories", names.length > 0);
  ok("includes a seeded default", names.includes("Food & Drink"));
});

await test("a filled template imports with category and direction intact", async () => {
  const { path } = await downloadTemplate();
  const filled = await fillTemplate(path, [
    ["2026-09-01", `Kopi ${RUN}`, 45000, "expense", "Food & Drink"],
    ["2026-09-02", `Gaji ${RUN}`, 8500000, "income", "Salary"],
  ]);
  await upload(filled);

  eq("two rows to review", await reviewRows().count(), 2);

  const body = (await page.locator("body").textContent()) || "";
  ok("read without the AI", /read the table directly/i.test(body));

  // Amounts live in input values, which textContent never sees.
  const amounts = await page
    .locator('input[inputmode="numeric"]')
    .evaluateAll((els) => els.map((e) => e.value));
  ok(`the expense amount survived (${amounts.join(" | ")})`, amounts.includes("45,000"));
  ok("the income amount survived", amounts.includes("8,500,000"));

  const selects = page.locator('select[name="category_id"]');
  const first = await selects.nth(0).locator("option:checked").textContent();
  const second = await selects.nth(1).locator("option:checked").textContent();
  eq("first row pre-filled its category", (first || "").trim(), "Food & Drink");
  eq("second row pre-filled its category", (second || "").trim(), "Salary");
});

await test("the Type column decides direction, not the sign", async () => {
  const { path } = await downloadTemplate();
  // A positive amount that must still be read as an expense.
  const filled = await fillTemplate(path, [
    ["2026-09-03", `Positive expense ${RUN}`, 61000, "expense", "Bills"],
  ]);
  await upload(filled);

  const kind = await page.locator('input[name="kind"]').first().inputValue();
  eq("posted as an expense", kind, "expense");
});

await test("an unknown category arrives blank rather than guessed", async () => {
  const { path } = await downloadTemplate();
  const filled = await fillTemplate(path, [
    ["2026-09-04", `Mystery ${RUN}`, 12000, "expense", "Not A Real Category"],
  ]);
  await upload(filled);

  const selected = await page
    .locator('select[name="category_id"]')
    .first()
    .locator("option:checked")
    .textContent();
  eq("left for the user to set", (selected || "").trim(), "Uncategorized");
});

await test("importing a filled template really creates the transactions", async () => {
  const note = `Template import ${RUN}`;
  // Dated today so it sorts to the top: the register shows the most recent 100,
  // and this account accumulates rows from every previous run.
  const today = new Date().toISOString().slice(0, 10);
  const { path } = await downloadTemplate();
  const filled = await fillTemplate(path, [[today, note, 33000, "expense", "Bills"]]);
  await upload(filled);

  await page.getByRole("button", { name: /Import 1 transaction/i }).click();
  // The review screen pushes to /transactions once the insert succeeds.
  await page.waitForURL(/\/transactions/, { timeout: 30_000 });
  const row = page.locator(".row-hover").filter({ hasText: note }).first();
  eq("the transaction is in the register", await row.count(), 1);
  const text = (await row.textContent()) || "";
  ok("with its amount", text.includes("33,000"));
  ok("and its category", text.includes("Bills"));
});

await test("the example row explains itself if left in", async () => {
  const { path } = await downloadTemplate();
  await upload(path);
  const note = await page.locator('input[name="note"]').first().inputValue();
  ok("captioned as an example", /delete this row/i.test(note));
});

await test("no uncaught page errors or 5xx responses during the run", async () => {
  check("clean console and network", errors.length === 0, errors.join("; "));
});

const passed = summary();
await browser.close();
process.exit(passed ? 0 : 1);

/**
 * End-to-end coverage for category management and the orphan rows a delete
 * leaves behind.
 *
 * These are the cases a unit test cannot reach: the confirm→mutate→revalidate
 * round trip, what a <select> actually preselects, whether two screens agree
 * about the same money, and what a stale dialog does when the row it points at
 * is already gone.
 *
 * Tests share one anonymous user (see harness.mjs) and must clean up after
 * themselves. Every name is suffixed with RUN so a rerun never collides.
 */

import {
  launch, test, summary, check, eq, ok,
  go, rupiah, RUN,
  addCategory, removeCategory, deleteTrigger, addTransaction, txRow, waitForCount,
} from "./harness.mjs";

const { browser, page } = await launch();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
page.on("response", (r) => {
  if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
});

const N = (s) => `${s} ${RUN}`;

/* ══ delete: the destructive round trip ════════════════════════════════════ */

await test("confirming a delete removes the row and closes the dialog", async () => {
  const name = N("Del");
  await addCategory(page, name);
  await deleteTrigger(page, name).waitFor();

  await deleteTrigger(page, name).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  ok("row disappears", await waitForCount(page, name, 0));

  await page
    .getByRole("dialog")
    .waitFor({ state: "detached", timeout: 10_000 });
  eq("dialog unmounted, not left behind", await page.getByRole("dialog").count(), 0);
  await go(page, "/categories");
  eq("row stays gone after a reload", await deleteTrigger(page, name).count(), 0);
});

await test("cancelling a delete keeps the category", async () => {
  const name = N("Keep");
  await addCategory(page, name);
  await deleteTrigger(page, name).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(400);

  eq("dialog closed", await page.getByRole("dialog").count(), 0);
  await go(page, "/categories");
  eq("category survived", await deleteTrigger(page, name).count(), 1);
  await removeCategory(page, name);
});

await test("Escape closes the delete dialog without deleting", async () => {
  const name = N("Esc");
  await addCategory(page, name);
  await deleteTrigger(page, name).click();
  await page.getByRole("heading", { name: /Delete/ }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await go(page, "/categories");
  eq("category survived Escape", await deleteTrigger(page, name).count(), 1);
  await removeCategory(page, name);
});

/* ══ what a delete leaves behind ═══════════════════════════════════════════ */

await test("a deleted category's transaction survives as Uncategorized", async () => {
  const name = N("Orphan");
  const note = N("orphan-tx");
  await addCategory(page, name);
  await addTransaction(page, { amount: 777000, category: name, note });
  await removeCategory(page, name);

  await go(page, "/transactions");
  const row = txRow(page, note);
  eq("row still present", await row.count(), 1);
  const text = (await row.textContent()) || "";
  ok("amount intact", text.includes("777.000"));
  ok("reads as Uncategorized", text.includes("Uncategorized"));
  ok("old category name is gone", !text.includes(name));
});

await test("the dashboard breakdown still adds up to the Expenses tile", async () => {
  // Regression: uncategorized spend was counted in the tile but skipped in the
  // breakdown, so the two figures on one screen disagreed with no explanation.
  await go(page, "/");
  const body = (await page.locator("body").textContent()) || "";
  // textContent gives the source text; the tiles are uppercased by CSS only.
  const tile = rupiah(body.slice(body.indexOf("Expenses"), body.indexOf("Net")))[0] ?? 0;

  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Spending by category/ }),
  });
  const ledger = (await section.textContent()) || "";
  const sum = rupiah(ledger).reduce((a, b) => a + b, 0);

  ok("the Expenses tile is non-zero", tile > 0);
  ok("the breakdown lists something", rupiah(ledger).length > 0);
  eq("breakdown sums to the Expenses tile", sum, tile);
});

await test("a deleted category leaves its recurring rule running", async () => {
  const name = N("RecCat");
  const note = N("rec-rule");
  await addCategory(page, name);

  await go(page, "/recurring");
  await page.locator("#rec-note").fill(note);
  await page.locator("#rec-amount").fill("450000");
  await page.locator("#rec-category").selectOption({ label: name });
  await page.getByRole("button", { name: "Create rule" }).click();
  await page.getByText(note).first().waitFor();

  await removeCategory(page, name);
  await go(page, "/recurring");
  const row = page.locator(".row-hover").filter({ hasText: note }).first();
  eq("rule still present", await row.count(), 1);
  ok("rule reads as Uncategorized", ((await row.textContent()) || "").includes("Uncategorized"));
});

await test("deleting a budgeted category warns with the real figure", async () => {
  const name = N("Budgeted");
  await addCategory(page, name);

  await go(page, "/budgets");
  const forms = page.locator("form").filter({ has: page.locator('input[name="limit_amount"]') });
  let set = false;
  for (let i = 0; i < (await forms.count()); i++) {
    const form = forms.nth(i);
    if (((await form.locator("xpath=..").textContent()) || "").includes(name)) {
      await form.locator('input[inputmode="numeric"]').fill("2000000");
      await form.getByRole("button", { name: "Save" }).click();
      set = true;
      break;
    }
  }
  ok("a limit was set", set);
  await page.waitForTimeout(900);

  await go(page, "/categories");
  await deleteTrigger(page, name).click();
  await page.getByRole("heading", { name: /Delete/ }).waitFor();
  const dialog = (await page.getByRole("dialog").textContent()) || "";
  ok("warns it cannot be undone", /cannot be undone/i.test(dialog));
  ok("names the amount at risk", dialog.includes("2.000.000"));
  ok("says the limit is destroyed", /deleted for good/i.test(dialog));

  await page.getByRole("button", { name: "Delete category" }).click();
  ok("category removed", await waitForCount(page, name, 0));
});

/* ══ uncategorized handling in the transaction forms ═══════════════════════ */

await test("editing an Uncategorized transaction does not silently refile it", async () => {
  // Regression: with no blank option the browser preselected the first category,
  // so fixing a typo quietly filed the entry under whatever sorted first.
  const name = N("Refile");
  const note = N("refile-tx");
  await addCategory(page, name);
  await addTransaction(page, { amount: 123000, category: name, note });
  await removeCategory(page, name);

  await go(page, "/transactions");
  await txRow(page, note).getByRole("button", { name: "Edit transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const select = dialog.locator('select[name="category_id"]');
  eq("select preselects nothing", await select.inputValue(), "");
  eq(
    "shown as Uncategorized",
    ((await select.locator("option:checked").textContent()) || "").trim(),
    "Uncategorized",
  );

  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "detached", timeout: 15_000 });

  await go(page, "/transactions");
  ok(
    "still Uncategorized after saving",
    ((await txRow(page, note).textContent()) || "").includes("Uncategorized"),
  );
});

await test("a filed transaction can be deliberately unfiled", async () => {
  const note = N("unfile-tx");
  await go(page, "/transactions");
  await page.locator("#amount").fill("50000");
  await page.locator("#note").fill(note);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByText(note).first().waitFor();

  await txRow(page, note).getByRole("button", { name: "Edit transaction" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator('select[name="category_id"]').selectOption("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "detached", timeout: 15_000 });

  await go(page, "/transactions");
  ok(
    "row is now Uncategorized",
    ((await txRow(page, note).textContent()) || "").includes("Uncategorized"),
  );
});

await test("a transaction can be created Uncategorized from the add form", async () => {
  const note = N("new-unfiled");
  await go(page, "/transactions");
  await page.locator("#amount").fill("61000");
  await page.locator("#category_id").selectOption("");
  await page.locator("#note").fill(note);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByText(note).first().waitFor();

  ok(
    "created without a category",
    ((await txRow(page, note).textContent()) || "").includes("Uncategorized"),
  );
});

await test("the add form does not default to Uncategorized", async () => {
  await go(page, "/transactions");
  const value = await page.locator("#category_id").inputValue();
  ok("a real category is preselected", value !== "");
});

/* ══ rename ════════════════════════════════════════════════════════════════ */

await test("a rename propagates to the transactions register", async () => {
  const before = N("Before");
  const after = N("After");
  const note = N("rename-tx");
  await addCategory(page, before);
  await addTransaction(page, { amount: 99000, category: before, note });

  await go(page, "/categories");
  await page.getByRole("button", { name: `Rename ${before}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel("Name").fill(after);
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "detached", timeout: 15_000 });

  await go(page, "/transactions");
  const text = (await txRow(page, note).textContent()) || "";
  ok("register shows the new name", text.includes(after));
  ok("old name is gone", !text.includes(before));
  await removeCategory(page, after);
});

await test("renaming onto an existing name is rejected and the dialog stays open", async () => {
  const a = N("ClashA");
  const b = N("ClashB");
  await addCategory(page, a);
  await addCategory(page, b);

  await go(page, "/categories");
  await page.getByRole("button", { name: `Rename ${b}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel("Name").fill(a.toUpperCase());
  await dialog.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1200);

  eq("dialog is still open", await dialog.count(), 1);
  ok(
    "explains the collision",
    /already have an expense category/i.test((await dialog.textContent()) || ""),
  );
  await page.keyboard.press("Escape");
  await removeCategory(page, a);
  await removeCategory(page, b);
});

await test("renaming a category deleted in another tab reports it is gone", async () => {
  const name = N("Stale");
  await addCategory(page, name);
  await go(page, "/categories");
  await page.getByRole("button", { name: `Rename ${name}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();

  // Second tab deletes the row out from under the open dialog.
  const other = await page.context().newPage();
  await other.goto(page.url(), { waitUntil: "networkidle" });
  await other.getByRole("button", { name: `Delete ${name}` }).click();
  await other.getByRole("button", { name: "Delete category" }).click();
  ok("the other tab's delete committed", await waitForCount(other, name, 0));
  await other.close();

  await dialog.getByLabel("Name").fill(N("Stale renamed"));
  await dialog.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1500);
  ok(
    "says the category no longer exists",
    /no longer exists/i.test((await dialog.textContent()) || ""),
  );
  await page.keyboard.press("Escape");
});

/* ══ add: negative cases ═══════════════════════════════════════════════════ */

await test("a duplicate name is rejected, case- and space-insensitively", async () => {
  const name = N("Dup");
  await addCategory(page, name);
  await go(page, "/categories");
  await page.locator("#cat-name").fill(`   ${name.toUpperCase()}   `);
  await page.getByRole("button", { name: "Add category" }).click();
  await page.waitForTimeout(1200);

  const body = (await page.locator("body").textContent()) || "";
  ok("rejected with an explanation", /already have an expense category/i.test(body));
  eq("the typed text is preserved", await page.locator("#cat-name").inputValue(), `   ${name.toUpperCase()}   `);
  await removeCategory(page, name);
});

await test("the same name is allowed under the other kind", async () => {
  const name = N("BothKinds");
  await addCategory(page, name, "expense");
  await addCategory(page, name, "income");
  await go(page, "/categories");
  eq("both exist", await deleteTrigger(page, name).count(), 2);
  await removeCategory(page, name);
  await removeCategory(page, name);
});

await test("a whitespace-only name is refused", async () => {
  await go(page, "/categories");
  const before = await page.locator(".row-hover").count();
  await page.locator("#cat-name").fill("    ");
  await page.getByRole("button", { name: "Add category" }).click();
  await page.waitForTimeout(1000);
  await go(page, "/categories");
  eq("no category was created", await page.locator(".row-hover").count(), before);
});

await test("the name field clears after a successful add", async () => {
  const name = N("Clears");
  await addCategory(page, name);
  await deleteTrigger(page, name).waitFor();
  eq("field is empty", await page.locator("#cat-name").inputValue(), "");
  await removeCategory(page, name);
});

await test("the name field is capped at 40 characters", async () => {
  await go(page, "/categories");
  await page.locator("#cat-name").fill("x".repeat(60));
  eq("input truncates", (await page.locator("#cat-name").inputValue()).length, 40);
  await page.locator("#cat-name").fill("");
});

/* ══ re-creating a deleted name ════════════════════════════════════════════ */

await test("re-creating a deleted name does not re-adopt its old transactions", async () => {
  const name = N("Recreate");
  const note = N("recreate-tx");
  await addCategory(page, name);
  await addTransaction(page, { amount: 42000, category: name, note });
  await removeCategory(page, name);
  await addCategory(page, name);

  await go(page, "/transactions");
  ok(
    "the old entry stays Uncategorized",
    ((await txRow(page, note).textContent()) || "").includes("Uncategorized"),
  );
  await go(page, "/categories");
  const row = page.locator(".row-hover").filter({ hasText: name }).first();
  ok(
    "the new category shows no usage",
    ((await row.textContent()) || "").includes("—"),
  );
  await removeCategory(page, name);
});

/* ══ wrap up ═══════════════════════════════════════════════════════════════ */

await test("no uncaught page errors or 5xx responses during the run", async () => {
  check("clean console and network", errors.length === 0, errors.join("; "));
});

const passed = summary();
await browser.close();
process.exit(passed ? 0 : 1);

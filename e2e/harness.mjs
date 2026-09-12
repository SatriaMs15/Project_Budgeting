/**
 * A very small end-to-end harness over bare `playwright`.
 *
 * Why not @playwright/test: the project only depends on `playwright`, and the
 * runner would bring its own config, CLI and `npm test` semantics. The coverage
 * is what matters here; moving to the full runner is a separate decision.
 *
 * Why ONE shared browser session rather than a context per test: Supabase
 * rate-limits anonymous sign-ins (~30/hour per IP on the free tier) and every
 * fresh context burns one. Tests therefore share a user and must NOT assume an
 * empty database — each one works on uniquely named rows and cleans up after
 * itself.
 */

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const STATE = process.env.E2E_STATE ?? ".e2e-session.json";

/** Unique suffix so parallel or repeated runs never collide on a name. */
export const RUN = Math.random().toString(36).slice(2, 7);

/* ── assertions ──────────────────────────────────────────────────────────── */

const results = [];
let current = null;

export function check(label, pass, detail = "") {
  current.checks.push({ label, pass, detail });
  if (!pass) current.failed = true;
}

export const eq = (label, actual, expected) =>
  check(
    label,
    Object.is(actual, expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

export const ok = (label, actual) => check(label, !!actual, `got ${actual}`);

export async function test(name, fn) {
  current = { name, checks: [], failed: false };
  results.push(current);
  const started = Date.now();
  try {
    await fn();
  } catch (err) {
    current.failed = true;
    current.checks.push({ label: "threw", pass: false, detail: String(err).split("\n")[0] });
  }
  current.ms = Date.now() - started;
  const icon = current.failed ? "✗" : "✓";
  console.log(`${icon} ${name} (${current.ms}ms)`);
  for (const c of current.checks) {
    if (!c.pass) console.log(`    ✗ ${c.label} — ${c.detail}`);
  }
}

export function summary() {
  const failed = results.filter((r) => r.failed);
  const checks = results.reduce((n, r) => n + r.checks.length, 0);
  console.log(
    `\n${results.length - failed.length}/${results.length} tests passed, ${checks} checks`,
  );
  if (failed.length) {
    console.log("failed:");
    for (const f of failed) console.log("  -", f.name);
  }
  return failed.length === 0;
}

/* ── session ─────────────────────────────────────────────────────────────── */

/**
 * Acquire an anonymous session, retrying past the sign-in rate limit, and
 * persist it so later runs reuse the same user instead of burning quota.
 */
export async function launch() {
  const browser = await chromium.launch();
  const opts = { viewport: { width: 1440, height: 950 } };

  if (existsSync(STATE)) {
    const ctx = await browser.newContext({ ...opts, storageState: STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    if (!/Something went wrong/i.test((await page.locator("body").textContent()) || "")) {
      return { browser, ctx, page };
    }
    await ctx.close();
  }

  for (let attempt = 1; attempt <= 10; attempt++) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const signedIn = (await ctx.cookies()).some((c) => c.name.includes("auth-token"));
    if (signedIn) {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      if (!/Something went wrong/i.test((await page.locator("body").textContent()) || "")) {
        mkdirSync(".", { recursive: true });
        await ctx.storageState({ path: STATE });
        return { browser, ctx, page };
      }
    }
    await ctx.close();
    console.log(`  session attempt ${attempt} rate-limited, waiting 30s…`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error("could not acquire an anonymous session (rate limited)");
}

/* ── page helpers ────────────────────────────────────────────────────────── */

export const go = (page, path) =>
  page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

/** Parse every "Rp 1.234.567" in a string into numbers. */
export const rupiah = (text) =>
  [...text.matchAll(/Rp\s*([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, "")));

export async function addCategory(page, name, kind = "expense") {
  await go(page, "/categories");
  // Scope to the form: "Income" also labels the list's section heading.
  if (kind === "income") {
    await page.locator("form").getByText("Income", { exact: true }).click();
  }
  const before = await deleteTrigger(page, name).count();
  await page.locator("#cat-name").fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
  // Returning before the row lands let the next navigation abort the in-flight
  // server action, and the category was never created at all.
  await waitForCount(page, name, before + 1);
}

export function deleteTrigger(page, name) {
  return page.getByRole("button", { name: `Delete ${name}` });
}

/**
 * Wait until the number of rows with this name settles on `want`.
 *
 * A plain waitFor({state:"detached"}) is NOT safe here: revalidation remounts
 * the list, so the old node detaches for a moment even when the row is coming
 * back. That transient let a test continue before the delete had committed, and
 * the next action then ran against a row that still existed. Two consecutive
 * matching reads mean the re-render has actually settled.
 */
export async function waitForCount(page, name, want, timeout = 20_000) {
  const started = Date.now();
  let stable = 0;
  while (Date.now() - started < timeout) {
    stable = (await deleteTrigger(page, name).count()) === want ? stable + 1 : 0;
    if (stable >= 2) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Delete a category through the real dialog. Returns false if it wasn't there. */
export async function removeCategory(page, name) {
  await go(page, "/categories");
  const all = deleteTrigger(page, name);
  const before = await all.count();
  if (!before) return false;
  // .first(): the same name can legitimately exist under both kinds.
  await all.first().click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await waitForCount(page, name, before - 1);
  return true;
}

export async function addTransaction(page, { amount, category, note }) {
  await go(page, "/transactions");
  await page.locator("#amount").fill(String(amount));
  await page.locator("#category_id").selectOption({ label: category });
  await page.locator("#note").fill(note);
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByText(note).first().waitFor();
}

/** The transactions register row carrying this note. */
export const txRow = (page, note) =>
  page.locator(".row-hover").filter({ hasText: note }).first();

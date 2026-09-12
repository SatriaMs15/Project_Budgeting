import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  it("keeps every crawler out of every path", () => {
    // Nothing here is indexable — each page is one person's private ledger —
    // and a crawl costs real money: every uncookied page request mints a
    // Supabase user against the free tier's monthly active user allowance.
    const { rules } = robots();
    expect(rules).toMatchObject({ userAgent: "*", disallow: "/" });
  });

  it("does not allow anything back in by accident", () => {
    // Checked as a key, not a substring: "disallow" contains "allow".
    const rules = robots().rules as Record<string, unknown>;
    expect(Object.keys(rules)).not.toContain("allow");
  });

  it("names no sitemap, since there is nothing to advertise", () => {
    expect(robots().sitemap).toBeUndefined();
  });
});

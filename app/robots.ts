import type { MetadataRoute } from "next";

/**
 * Keep crawlers out.
 *
 * There is nothing here to index — every page renders one person's private
 * ledger behind an anonymous session — and a crawl is actively costly: each
 * uncookied page request mints a new Supabase user, which burns the anonymous
 * sign-in rate limit and counts toward the free tier's monthly active users.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}

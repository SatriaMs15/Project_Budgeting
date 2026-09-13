import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { buildImportTemplate } from "@/lib/import-template";

export const dynamic = "force-dynamic";

/**
 * Download the import template, built from the caller's own categories.
 *
 * A route handler rather than a server action: this returns a file for the
 * browser to save, which is a plain GET response, not a mutation.
 */
export async function GET() {
  const supabase = await createClient();
  const categories = unwrap(
    await supabase.from("categories").select("name, kind").order("name"),
    "load categories",
  );

  const file = await buildImportTemplate(categories);

  return new NextResponse(file as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="buku-kas-import-template.xlsx"',
      // Built per user from live categories, so it must never be cached.
      "Cache-Control": "no-store",
    },
  });
}

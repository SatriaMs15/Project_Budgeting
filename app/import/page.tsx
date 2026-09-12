import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { ImportForm } from "@/components/import-form";

export default async function ImportPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();
  const categories = unwrap(
    await supabase.from("categories").select("*").order("name"),
    "load categories",
  );

  return (
    <div>
      <h1 className="mb-1 font-heading text-[32px] font-semibold">Import</h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Upload a statement and we&apos;ll read the transactions out of it.
      </p>
      <ImportForm categories={categories} />
    </div>
  );
}

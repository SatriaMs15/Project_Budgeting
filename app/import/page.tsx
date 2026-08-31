import { createClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { ensureDefaultCategories } from "@/lib/categories";
import { ImportForm } from "@/components/import-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ImportPage() {
  await ensureDefaultCategories();

  const supabase = await createClient();
  const categories = unwrap(
    await supabase.from("categories").select("*").order("name"),
    "load categories",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <ImportForm categories={categories} />
      </CardContent>
    </Card>
  );
}

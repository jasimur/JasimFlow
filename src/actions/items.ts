"use server";

import { revalidatePath } from "next/cache";
import { catalogItemSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export async function saveCatalogItem(input: unknown) {
  const parsed = catalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_user_id", user.id).single();
  if (!business) return { ok: false as const, error: "Business not found" };
  const { id, ...fields } = parsed.data;
  const result = id
    ? await supabase.from("catalog_items").update(fields).eq("id", id).select("id").single()
    : await supabase.from("catalog_items").insert({ ...fields, business_id: business.id }).select("id").single();
  if (result.error) return { ok: false as const, error: result.error.message };
  revalidatePath("/items");
  return { ok: true as const, id: result.data.id };
}

export async function deleteCatalogItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/items");
  return { ok: true as const };
}

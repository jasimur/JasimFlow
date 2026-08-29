"use server";

import { revalidatePath } from "next/cache";
import { customerSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export async function saveCustomer(input: unknown) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid customer" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_user_id", user.id).single();
  if (!business) return { ok: false as const, error: "Business not found" };
  const { id, ...fields } = parsed.data;
  const result = id
    ? await supabase.from("customers").update(fields).eq("id", id).select("id").single()
    : await supabase.from("customers").insert({ ...fields, business_id: business.id }).select("id").single();
  if (result.error) return { ok: false as const, error: result.error.message };
  revalidatePath("/customers");
  return { ok: true as const, id: result.data.id };
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/customers");
  return { ok: true as const };
}

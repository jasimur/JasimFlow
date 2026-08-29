"use server";

import { revalidatePath } from "next/cache";
import { businessSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const LOGO_BUCKET = "company-logos";
const SIGNATURE_BUCKET = "authorized-signatures";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_SIGNATURE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

async function currentBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: business, error } = await supabase.from("businesses").select("id, logo_url").eq("owner_user_id", user.id).single();
  if (error || !business) return { ok: false as const, error: error?.message ?? "Business not found" };
  return { ok: true as const, supabase, user, business };
}

export async function saveBusinessSettings(input: unknown) {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { error } = await supabase.from("businesses").update(parsed.data).eq("owner_user_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function uploadBusinessLogo(formData: FormData) {
  const ctx = await currentBusiness();
  if (!ctx.ok) return ctx;
  const file = formData.get("logo");
  if (!file || typeof file === "string" || file.size === 0) return { ok: false as const, error: "Choose a logo image first" };
  if (!ALLOWED_LOGO_TYPES.has(file.type)) return { ok: false as const, error: "Logo must be PNG, JPG/JPEG, or WebP" };
  if (file.size > MAX_LOGO_BYTES) return { ok: false as const, error: "Logo must be 2 MB or smaller" };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${ctx.user.id}/${ctx.business.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await ctx.supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600"
  });
  if (uploadError) return { ok: false as const, error: uploadError.message };

  const { data } = ctx.supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await ctx.supabase.from("businesses").update({ logo_url: logoUrl }).eq("id", ctx.business.id);
  if (updateError) return { ok: false as const, error: updateError.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/quotations");
  revalidatePath("/invoices");
  return { ok: true as const, logoUrl };
}

export async function removeBusinessLogo() {
  const ctx = await currentBusiness();
  if (!ctx.ok) return ctx;
  // Do not delete the old storage object here: historical saved documents may
  // still reference that exact logo URL in their company snapshot.
  const { error } = await ctx.supabase.from("businesses").update({ logo_url: null }).eq("id", ctx.business.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/quotations");
  revalidatePath("/invoices");
  return { ok: true as const };
}

export async function seedDemoData() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_demo_data");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}


export async function uploadAuthorizedSignature(formData: FormData) {
  const ctx = await currentBusiness();
  if (!ctx.ok) return ctx;
  const file = formData.get("signature");
  if (!file || typeof file === "string" || file.size === 0) return { ok: false as const, error: "Choose a signature image first" };
  if (!ALLOWED_SIGNATURE_TYPES.has(file.type)) return { ok: false as const, error: "Signature must be PNG, JPG/JPEG, or WebP" };
  if (file.size > MAX_SIGNATURE_BYTES) return { ok: false as const, error: "Signature must be 1 MB or smaller" };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${ctx.user.id}/${ctx.business.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await ctx.supabase.storage.from(SIGNATURE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600"
  });
  if (uploadError) return { ok: false as const, error: uploadError.message };

  const { data } = ctx.supabase.storage.from(SIGNATURE_BUCKET).getPublicUrl(path);
  const signatureUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await ctx.supabase.from("businesses").update({ signature_url: signatureUrl }).eq("id", ctx.business.id);
  if (updateError) return { ok: false as const, error: updateError.message };

  revalidatePath("/settings");
  revalidatePath("/invoices");
  return { ok: true as const, signatureUrl };
}

export async function removeAuthorizedSignature() {
  const ctx = await currentBusiness();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.from("businesses").update({ signature_url: null }).eq("id", ctx.business.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/invoices");
  return { ok: true as const };
}

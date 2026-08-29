"use server";

import { revalidatePath } from "next/cache";
import { documentInputSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

function refreshDocuments() {
  revalidatePath("/dashboard");
  revalidatePath("/quotations");
  revalidatePath("/invoices");
}

export async function saveDocument(input: unknown) {
  const parsed = documentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid document" };
  }
  const supabase = await createClient();
  const payload = { ...parsed.data };
  delete (payload as { items?: unknown }).items;
  // Send the product name under two explicit keys. `product_name` is canonical;
  // `item_name` is a compatibility guard for databases upgraded through older
  // JasimFlow migrations. The v2 RPC always prefers product_name.
  const items = parsed.data.items.map((item) => ({
    ...item,
    product_name: item.product_name.trim(),
    item_name: item.product_name.trim(),
    description: item.description.trim()
  }));
  const result = parsed.data.id
    ? await supabase.rpc("update_document_v3", { p_document_id: parsed.data.id, p_payload: payload, p_items: items })
    : await supabase.rpc("create_document_v3", { p_payload: payload, p_items: items });
  if (result.error) return { ok: false as const, error: result.error.message };
  refreshDocuments();
  const id = String(result.data);
  revalidatePath(`/${parsed.data.document_type === "quotation" ? "quotations" : "invoices"}/${id}`);
  return { ok: true as const, id };
}

export async function duplicateDocument(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_document", { p_document_id: id });
  if (error) return { ok: false as const, error: error.message };
  refreshDocuments();
  return { ok: true as const, id: String(data) };
}

export async function convertQuotation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quotation_to_invoice", { p_document_id: id });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { id?: string; already_existed?: boolean } | null;
  if (!result?.id) return { ok: false as const, error: "Conversion did not return an invoice id" };
  refreshDocuments();
  return { ok: true as const, id: result.id, alreadyExisted: Boolean(result.already_existed) };
}

export async function setDocumentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_status", { p_document_id: id, p_status: status });
  if (error) return { ok: false as const, error: error.message };
  refreshDocuments();
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/quotations/${id}`);
  return { ok: true as const };
}


export async function setDocumentTemplate(id: string, template: string) {
  const allowed = new Set(["classic", "executive", "tech", "minimal", "graphite", "emerald", "copper"]);
  if (!allowed.has(template)) return { ok: false as const, error: "Invalid document template" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_template_v2", { p_document_id: id, p_template_style: template });
  if (error) return { ok: false as const, error: error.message };
  refreshDocuments();
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/invoices/${id}/edit`);
  revalidatePath(`/quotations/${id}`);
  revalidatePath(`/quotations/${id}/edit`);
  return { ok: true as const };
}

export async function deleteDocument(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  refreshDocuments();
  return { ok: true as const };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business, CatalogItem, Customer, DocumentRecord } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

export async function getBusiness(): Promise<Business> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("businesses").select("*").eq("owner_user_id", user.id).single();
  if (error || !data) throw new Error(error?.message ?? "Business profile not found");
  return data as Business;
}

export async function getCustomers(): Promise<Customer[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("customers").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("catalog_items").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}

export async function getDocuments(type?: "quotation" | "invoice"): Promise<DocumentRecord[]> {
  const { supabase } = await requireUser();
  let query = supabase.from("documents").select("*").order("issue_date", { ascending: false }).order("created_at", { ascending: false });
  if (type) query = query.eq("document_type", type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRecord[];
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: items, error: itemsError } = await supabase.from("document_items").select("*").eq("document_id", id).order("sort_order", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  return { ...(data as DocumentRecord), document_items: (items ?? []) as DocumentRecord["document_items"] };
}

export async function getDocumentNumberSuggestion(type: "quotation" | "invoice", business: Business): Promise<string> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("document_counters")
    .select("next_number")
    .eq("business_id", business.id)
    .eq("document_type", type)
    .maybeSingle();
  const rawNext = Number(data?.next_number ?? 1);
  const prefix = type === "quotation" ? business.quotation_prefix : business.invoice_prefix;
  let next = Number.isFinite(rawNext) && rawNext > 0 ? Math.trunc(rawNext) : 1;

  // This is only a UI suggestion; the PostgreSQL counter remains authoritative.
  // Skip a manually occupied future number so the field normally matches the value
  // that the database will assign if the user leaves it unchanged.
  for (let i = 0; i < 100; i += 1) {
    const candidate = `${prefix}-${String(next).padStart(4, "0")}`;
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("business_id", business.id)
      .eq("document_type", type)
      .eq("document_number", candidate)
      .maybeSingle();
    if (!existing) return candidate;
    next += 1;
  }

  return `${prefix}-${String(next).padStart(4, "0")}`;
}

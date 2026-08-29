export type DocumentType = "quotation" | "invoice";
export type DiscountType = "none" | "percentage" | "fixed";
export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type InvoiceStatus = "draft" | "unpaid" | "paid" | "overdue" | "cancelled";
export type DocumentStatus = QuotationStatus | InvoiceStatus;
export type TemplateStyle = "classic" | "executive" | "tech" | "minimal" | "graphite" | "emerald" | "copper";

export interface Business {
  id: string;
  owner_user_id: string;
  name: string;
  logo_url: string | null;
  signature_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_number: string | null;
  currency: string;
  default_tax_rate: string;
  quotation_prefix: string;
  invoice_prefix: string;
  default_quotation_terms: string | null;
  default_invoice_terms: string | null;
  bank_details: string | null;
  show_document_credit: boolean;
  document_credit_text: string;
  show_authorized_signature: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  tax_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  default_unit: string;
  default_rate: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSnapshot {
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  tax_number?: string | null;
}

export interface CompanySnapshot {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tax_number?: string | null;
  bank_details?: string | null;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  catalog_item_id: string | null;
  product_name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
  sort_order: number;
}

export interface DocumentRecord {
  id: string;
  business_id: string;
  document_type: DocumentType;
  document_number: string;
  customer_id: string | null;
  customer_snapshot: CustomerSnapshot;
  company_snapshot: CompanySnapshot;
  currency: string;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  project_reference: string | null;
  status: DocumentStatus;
  template_style: TemplateStyle;
  subtotal: string;
  discount_type: DiscountType;
  discount_value: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  grand_total: string;
  notes: string | null;
  terms: string | null;
  source_document_id: string | null;
  created_at: string;
  updated_at: string;
  document_items?: DocumentItem[];
}

export interface EditorLineItem {
  id?: string;
  catalog_item_id?: string | null;
  product_name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

export interface DocumentEditorInput {
  id?: string;
  document_type: DocumentType;
  document_number?: string;
  customer_id: string;
  issue_date: string;
  valid_until?: string;
  due_date?: string;
  project_reference?: string;
  status: DocumentStatus;
  template_style: TemplateStyle;
  discount_type: DiscountType;
  discount_value: string;
  tax_rate: string;
  notes: string;
  terms: string;
  items: EditorLineItem[];
}

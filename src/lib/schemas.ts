import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().default("");
const decimalString = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/, "Enter a valid non-negative number");

export const customerSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(160),
  contact_person: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  email: z.union([z.literal(""), z.email()]).optional().default(""),
  billing_address: z.string().trim().max(1000).optional().default(""),
  tax_number: z.string().trim().max(120).optional().default(""),
  notes: optionalText
});

export const catalogItemSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(180),
  description: z.string().trim().max(1000).optional().default(""),
  default_unit: z.string().trim().min(1).max(40),
  default_rate: decimalString
});

export const businessSchema = z.object({
  name: z.string().trim().min(1).max(180),
  address: z.string().trim().max(1000).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  email: z.union([z.literal(""), z.email()]).optional().default(""),
  website: z.union([z.literal(""), z.url()]).optional().default(""),
  tax_number: z.string().trim().max(120).optional().default(""),
  currency: z.string().trim().min(3).max(3),
  default_tax_rate: decimalString.refine((v) => Number(v) <= 100, "Tax rate cannot exceed 100%"),
  quotation_prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9_-]+$/),
  invoice_prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9_-]+$/),
  default_quotation_terms: optionalText,
  default_invoice_terms: optionalText,
  bank_details: optionalText,
  show_document_credit: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()).default(true),
  document_credit_text: z.string().trim().max(160).optional().default("Powered by JasimFlow · by Jasim"),
  show_authorized_signature: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()).default(true)
});

const documentItemSchema = z.object({
  catalog_item_id: z.union([z.literal(""), z.uuid(), z.null()]).optional(),
  product_name: z.string().trim().min(1, "Product name is required").max(240),
  description: z.string().trim().max(1600).optional().default(""),
  quantity: decimalString,
  unit: z.string().trim().min(1).max(40),
  unit_price: decimalString
});

export const documentInputSchema = z.object({
  id: z.uuid().optional(),
  document_type: z.enum(["quotation", "invoice"]),
  document_number: z.string().trim().max(64, "Document number is too long").regex(/^[^\r\n\t]*$/, "Document number contains invalid characters").optional().default(""),
  customer_id: z.uuid(),
  issue_date: z.iso.date(),
  valid_until: z.union([z.literal(""), z.iso.date()]).optional(),
  due_date: z.union([z.literal(""), z.iso.date()]).optional(),
  project_reference: z.string().trim().max(180, "Project / reference is too long").optional().default(""),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "unpaid", "paid", "overdue", "cancelled"]),
  template_style: z.enum(["classic", "executive", "tech", "minimal", "graphite", "emerald", "copper"]).default("classic"),
  discount_type: z.enum(["none", "percentage", "fixed"]),
  discount_value: decimalString,
  tax_rate: decimalString.refine((v) => Number(v) <= 100, "Tax rate cannot exceed 100%"),
  notes: optionalText,
  terms: optionalText,
  items: z.array(documentItemSchema).min(1, "Add at least one line item").max(200)
}).superRefine((value, ctx) => {
  const quotationStatuses = new Set(["draft", "sent", "accepted", "rejected", "expired"]);
  const invoiceStatuses = new Set(["draft", "unpaid", "paid", "overdue", "cancelled"]);
  if (value.document_type === "quotation" && !quotationStatuses.has(value.status)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Invalid quotation status" });
  }
  if (value.document_type === "invoice" && !invoiceStatuses.has(value.status)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Invalid invoice status" });
  }
  if (value.document_type === "quotation" && !value.valid_until) {
    ctx.addIssue({ code: "custom", path: ["valid_until"], message: "Valid until is required" });
  }
  if (value.document_type === "invoice" && !value.due_date) {
    ctx.addIssue({ code: "custom", path: ["due_date"], message: "Due date is required" });
  }
  if (value.document_type === "quotation" && value.valid_until && value.valid_until < value.issue_date) {
    ctx.addIssue({ code: "custom", path: ["valid_until"], message: "Valid until cannot be before issue date" });
  }
  if (value.document_type === "invoice" && value.due_date && value.due_date < value.issue_date) {
    ctx.addIssue({ code: "custom", path: ["due_date"], message: "Due date cannot be before issue date" });
  }
  if (value.discount_type === "percentage" && Number(value.discount_value) > 100) {
    ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Percentage discount cannot exceed 100%" });
  }
});

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { saveDocument, setDocumentTemplate } from "@/actions/documents";
import { QuickCustomerModal } from "@/components/quick-customer-modal";
import { useToast } from "@/components/toast";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { calculateTotals, centsToFixed, lineTotalCents } from "@/lib/money";
import type { Business, CatalogItem, Customer, DiscountType, DocumentRecord, DocumentStatus, DocumentType, EditorLineItem, TemplateStyle } from "@/lib/types";
import { addDaysISO, todayISO } from "@/lib/utils";

type LocalLine = EditorLineItem & { key: string };

const templateOptions: Array<{ value: TemplateStyle; label: string }> = [
  { value: "classic", label: "Jasim Classic" },
  { value: "executive", label: "Executive Split" },
  { value: "tech", label: "Tech Grid" },
  { value: "minimal", label: "Minimal Ledger" },
  { value: "graphite", label: "Graphite Sidebar" },
  { value: "emerald", label: "Emerald Commerce" },
  { value: "copper", label: "Copper Letterhead" }
];

function initialLines(document?: DocumentRecord | null): LocalLine[] {
  if (document?.document_items?.length) {
    return document.document_items.map((item, i) => ({
      key: `saved-${i}-${item.id}`,
      catalog_item_id: item.catalog_item_id,
      product_name: String(item.product_name ?? "").trim() || String(item.description ?? "").trim() || "Product",
      description: String(item.description ?? ""),
      quantity: String(item.quantity),
      unit: item.unit || "pcs",
      unit_price: String(item.unit_price)
    }));
  }
  return [{ key: "initial-0", catalog_item_id: null, product_name: "", description: "", quantity: "1", unit: "pcs", unit_price: "0" }];
}

const quotationStatuses: DocumentStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];
const invoiceStatuses: DocumentStatus[] = ["draft", "unpaid", "paid", "overdue", "cancelled"];
const units = ["pcs", "set", "box", "meter", "roll", "point", "device", "license", "job", "service", "hour", "day", "kg", "custom"];

export function DocumentEditor({
  type,
  business,
  customers,
  catalogItems,
  document,
  suggestedNumber
}: {
  type: DocumentType;
  business: Business;
  customers: Customer[];
  catalogItems: CatalogItem[];
  document?: DocumentRecord | null;
  suggestedNumber?: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const defaultPrefix = type === "invoice" ? business.invoice_prefix : business.quotation_prefix;
  const initialNumber = document?.document_number ?? suggestedNumber ?? `${defaultPrefix}-0001`;
  const [documentNumber, setDocumentNumber] = useState(initialNumber);
  const [customerId, setCustomerId] = useState(document?.customer_id ?? customers[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(document?.issue_date ?? todayISO());
  const [validUntil, setValidUntil] = useState(document?.valid_until ?? addDaysISO(30));
  const [dueDate, setDueDate] = useState(document?.due_date ?? addDaysISO(14));
  const [projectReference, setProjectReference] = useState(document?.project_reference ?? "");
  const [status, setStatus] = useState<DocumentStatus>(document?.status ?? (type === "quotation" ? "draft" : "unpaid"));
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>(document?.template_style ?? "classic");
  const [discountType, setDiscountType] = useState<DiscountType>(document?.discount_type ?? "none");
  const [discountValue, setDiscountValue] = useState(document?.discount_value ?? "0");
  const [taxRate, setTaxRate] = useState(document?.tax_rate ?? business.default_tax_rate ?? "0");
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [terms, setTerms] = useState(document?.terms ?? (type === "quotation" ? business.default_quotation_terms : business.default_invoice_terms) ?? "");
  const [lines, setLines] = useState<LocalLine[]>(() => initialLines(document));
  const totals = useMemo(() => calculateTotals(lines, discountType, discountValue, taxRate), [lines, discountType, discountValue, taxRate]);
  const selectedTemplate = templateOptions.find((option) => option.value === templateStyle) ?? templateOptions[0];
  const productListId = `jasimflow-products-${type}-${document?.id ?? "new"}`;

  function patchLine(index: number, patch: Partial<LocalLine>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  function applyCatalogByName(index: number, productName: string) {
    const normalized = productName.trim().toLocaleLowerCase();
    if (!normalized) {
      patchLine(index, { catalog_item_id: null });
      return;
    }
    const item = catalogItems.find((candidate) => candidate.name.trim().toLocaleLowerCase() === normalized);
    if (!item) {
      patchLine(index, { catalog_item_id: null });
      return;
    }
    patchLine(index, {
      catalog_item_id: item.id,
      product_name: item.name,
      description: item.description ?? "",
      unit: item.default_unit || "pcs",
      unit_price: String(item.default_rate)
    });
  }

  function addLine() {
    setLines((current) => [...current, { key: `new-${Date.now()}-${current.length}`, catalog_item_id: null, product_name: "", description: "", quantity: "1", unit: "pcs", unit_price: "0" }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    setLines((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function onCustomerCreated(customer: Customer) {
    setLocalCustomers((current) => [...current.filter((c) => c.id !== customer.id), customer].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(customer.id);
    router.refresh();
  }

  function chooseTemplate(nextTemplate: TemplateStyle) {
    setTemplateStyle(nextTemplate);
    const documentId = document?.id;
    if (!documentId) return;
    startTransition(async () => {
      const result = await setDocumentTemplate(documentId, nextTemplate);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      router.refresh();
    });
  }

  function persist(preview: boolean) {
    if (!customerId) {
      show("Select a customer before saving.", "error");
      return;
    }
    if (!documentNumber.trim()) {
      show(`${type === "quotation" ? "Quotation" : "Invoice"} number cannot be empty.`, "error");
      return;
    }
    if (lines.some((line) => !line.product_name.trim())) {
      show("Every line item needs a product or service name.", "error");
      return;
    }

    const customDocumentNumber = Boolean(document) || documentNumber.trim() !== (suggestedNumber ?? initialNumber).trim()
      ? documentNumber.trim()
      : "";

    const payload = {
      id: document?.id,
      document_type: type,
      document_number: customDocumentNumber,
      customer_id: customerId,
      issue_date: issueDate,
      valid_until: type === "quotation" ? validUntil : "",
      due_date: type === "invoice" ? dueDate : "",
      project_reference: type === "quotation" ? projectReference.trim() : "",
      status,
      template_style: templateStyle,
      discount_type: discountType,
      discount_value: discountType === "none" ? "0" : discountValue || "0",
      tax_rate: taxRate || "0",
      notes,
      terms,
      items: lines.map(({ catalog_item_id, product_name, description, quantity, unit, unit_price }) => ({
        catalog_item_id: catalog_item_id ?? null,
        product_name: product_name.trim(),
        description: description.trim(),
        quantity: quantity || "0",
        unit: unit || "pcs",
        unit_price: unit_price || "0"
      }))
    };

    startTransition(async () => {
      const result = await saveDocument(payload);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      show(document ? "Document updated" : "Document created", "success");
      const base = type === "quotation" ? "quotations" : "invoices";
      if (preview) router.push(`/${base}/${result.id}`);
      else if (!document) router.replace(`/${base}/${result.id}/edit`);
      router.refresh();
    });
  }

  return <>
    <datalist id={productListId}>
      {catalogItems.map((item) => <option key={item.id} value={item.name} />)}
    </datalist>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        {localCustomers.length === 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">No customer yet. Use <strong>New customer</strong> below to create one without leaving this {type}.</div>}
        <Card>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Document details</h2>
              <p className="text-sm text-[var(--muted)]">{type === "quotation" ? "Quotation" : "Invoice"} number is suggested automatically, but you can edit it.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wider">{type}</span>
          </div>

          <div className="mb-4 max-w-md">
            <Label>{type === "quotation" ? "Quotation number" : "Invoice number"}</Label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              maxLength={64}
              placeholder={`${type === "quotation" ? business.quotation_prefix : business.invoice_prefix}-0001`}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Must be unique. {type === "quotation"
                ? "Examples: QUO-0001, 2026/QUO/001, SITE-A-Q01."
                : "Examples: INV-0001, 2026/INV/001, CLIENT-A-17."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-1 flex items-center justify-between gap-3">
                <Label>Customer</Label>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--navy)] hover:underline" onClick={() => setCustomerModalOpen(true)}>
                  <UserPlus size={14}/>New customer
                </button>
              </div>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer…</option>
                {localCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>{type === "quotation" ? "Valid until" : "Due date"}</Label><Input type="date" value={type === "quotation" ? validUntil : dueDate} onChange={(e) => type === "quotation" ? setValidUntil(e.target.value) : setDueDate(e.target.value)} /></div>
          </div>
          {type === "quotation" && <div className="mt-4 max-w-2xl">
            <Label>Project / Reference <span className="font-normal text-[var(--muted)]">(optional)</span></Label>
            <Input value={projectReference} onChange={(e) => setProjectReference(e.target.value)} maxLength={180} placeholder="e.g. CCTV Installation – Office Floor 2" />
            <p className="mt-1 text-xs text-[var(--muted)]">Helps the customer identify which project, site or work this quotation is for.</p>
          </div>}
          <div className="mt-4"><Label>Status</Label><div className="max-w-sm"><Select value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus)}>{(type === "quotation" ? quotationStatuses : invoiceStatuses).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select></div></div>

          <div className="mt-5 border-t border-[var(--rule)] pt-5">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div><Label>Document template</Label><p className="mt-1 text-xs text-[var(--muted)]">Selected: {selectedTemplate.label}.{document ? " Applied immediately." : " It will be saved with this document."}</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templateOptions.map((option) => {
                const active = option.value === templateStyle;
                return <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseTemplate(option.value)}
                  className={`template-choice template-choice-${option.value} ${active ? "template-choice-active" : ""}`}
                >
                  <span className="template-choice-paper" aria-hidden="true"><span/><span/><span/></span>
                  <span className="text-left text-xs font-extrabold">{option.label}</span>
                </button>;
              })}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] p-5">
            <h2 className="text-lg font-bold">Products & services</h2>
            <Button type="button" variant="secondary" onClick={addLine}><Plus size={16}/>Add product</Button>
          </div>

          <div className="divide-y divide-[#eeeae3]">
            {lines.map((line, index) => <div key={line.key} className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Item {index + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-md p-2 hover:bg-slate-100" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up"><ChevronUp size={15}/></button>
                  <button type="button" className="rounded-md p-2 hover:bg-slate-100" onClick={() => move(index, 1)} disabled={index === lines.length - 1} aria-label="Move down"><ChevronDown size={15}/></button>
                  <button type="button" className="rounded-md p-2 text-red-700 hover:bg-red-50" onClick={() => removeLine(index)} disabled={lines.length === 1} aria-label="Remove item"><Trash2 size={15}/></button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Label>Product</Label>
                  <Input
                    list={productListId}
                    value={line.product_name}
                    onChange={(e) => patchLine(index, { product_name: e.target.value, catalog_item_id: null })}
                    onBlur={() => applyCatalogByName(index, line.product_name)}
                    placeholder="Product or service name"
                  />
                </div>
                <div className="md:col-span-7">
                  <Label>Description</Label>
                  <Textarea className="min-h-[44px] py-2" rows={1} value={line.description} onChange={(e) => patchLine(index, { description: e.target.value })} placeholder="Model, warranty or other details" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[100px_120px_minmax(130px,1fr)_minmax(150px,1fr)]">
                <div><Label>Qty</Label><Input type="number" min="0" step="0.0001" value={line.quantity} onChange={(e) => patchLine(index, { quantity: e.target.value })} /></div>
                <div><Label>Unit</Label><Select value={line.unit} onChange={(e) => patchLine(index, { unit: e.target.value })}>{units.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                <div><Label>Rate</Label><Input type="number" min="0" step="0.0001" value={line.unit_price} onChange={(e) => patchLine(index, { unit_price: e.target.value })} /></div>
                <div><Label>Amount</Label><div className="field flex min-h-[42px] items-center justify-end bg-slate-50 font-bold money">{business.currency} {centsToFixed(lineTotalCents(line.quantity, line.unit_price))}</div></div>
              </div>
            </div>)}
          </div>
          <div className="border-t border-[var(--rule)] p-5"><Button type="button" variant="secondary" onClick={addLine}><Plus size={16}/>Add another product</Button></div>
        </Card>

        <Card><div className="grid gap-4 lg:grid-cols-2"><div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note — delivery time, installation scope, contact details, etc." /></div><div><Label>Terms & conditions</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, warranty conditions, validity, delivery terms, exclusions…" /></div></div></Card>
      </div>

      <aside><Card className="sticky top-6"><h2 className="text-lg font-bold">Totals</h2><div className="mt-4 grid gap-4"><div><Label>Discount</Label><div className="grid grid-cols-[130px_1fr] gap-2"><Select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}><option value="none">None</option><option value="percentage">Percentage</option><option value="fixed">Fixed</option></Select><Input type="number" min="0" max={discountType === "percentage" ? "100" : undefined} step="0.0001" disabled={discountType === "none"} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /></div></div><div><Label>Tax / VAT %</Label><Input type="number" min="0" max="100" step="0.0001" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div></div><div className="my-5 border-t border-[var(--rule)]"/><div className="grid gap-3 text-sm money"><div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><strong>{business.currency} {totals.subtotal}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><strong>- {business.currency} {totals.discount}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">Tax</span><strong>{business.currency} {totals.tax}</strong></div><div className="mt-2 flex justify-between border-t border-[var(--rule)] pt-4 text-lg"><span className="font-black">Grand total</span><strong>{business.currency} {totals.grandTotal}</strong></div></div><p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-[var(--muted)]">These totals are an instant preview. Stored totals are recalculated by the database when you save.</p><div className="mt-5 grid gap-2"><Button type="button" onClick={() => persist(true)} disabled={pending || localCustomers.length === 0}><Save size={16}/>{pending ? "Saving…" : "Save & preview"}</Button><Button type="button" variant="secondary" onClick={() => persist(false)} disabled={pending || localCustomers.length === 0}>Save</Button></div></Card></aside>
    </div>

    <QuickCustomerModal open={customerModalOpen} businessId={business.id} onClose={() => setCustomerModalOpen(false)} onCreated={onCustomerCreated} />
  </>;
}

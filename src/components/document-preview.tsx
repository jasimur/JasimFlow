/* eslint-disable @next/next/no-img-element */
import type { DocumentRecord, TemplateStyle } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { humanizeStatus } from "@/lib/utils";

const allowedTemplates = new Set<TemplateStyle>(["classic", "executive", "tech", "minimal", "graphite", "emerald", "copper"]);

export function DocumentPreview({ document, showDocumentCredit = true, documentCreditText = "Powered by JasimFlow · by Jasim", showAuthorizedSignature = false, signatureUrl = null }: { document: DocumentRecord; showDocumentCredit?: boolean; documentCreditText?: string; showAuthorizedSignature?: boolean; signatureUrl?: string | null }) {
  const company = document.company_snapshot ?? { name: "Business" };
  const customer = document.customer_snapshot ?? { name: "Customer" };
  const items = document.document_items ?? [];
  const isInvoice = document.document_type === "invoice";
  const isPaid = isInvoice && document.status === "paid";
  const template: TemplateStyle = allowedTemplates.has(document.template_style) ? document.template_style : "classic";

  return <article className={`print-sheet document-paper document-template document-template-${template} mx-auto overflow-hidden border bg-white shadow-[0_18px_55px_rgba(16,36,62,.10)]`}>
    <div className="doc-accent-bar" />
    <div className="doc-body">
      <header className="doc-header">
        <div className="doc-company flex min-w-0 items-start gap-4">
          {company.logo_url && <div className="doc-logo flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-white p-2"><img src={company.logo_url} alt="Company logo" className="h-full w-full object-contain" /></div>}
          <div className="min-w-0">
            <h1 className="doc-company-name break-words text-2xl font-black tracking-tight sm:text-3xl">{company.name}</h1>
            <div className="doc-company-details mt-2 whitespace-pre-line text-xs leading-5">
              {company.address}
              {company.phone && <><br />{company.phone}</>}
              {company.email && <><br />{company.email}</>}
              {company.website && <><br />{company.website}</>}
            </div>
            {company.tax_number && <p className="doc-tax mt-1 text-xs font-medium">Tax/VAT: {company.tax_number}</p>}
          </div>
        </div>

        <div className="doc-title-block sm:min-w-60 sm:text-right">
          <p className="doc-kicker text-[11px] font-black uppercase tracking-[.28em]">{isInvoice ? "Invoice" : "Quotation"}</p>
          <h2 className="doc-number mt-2 break-all text-3xl font-black tracking-tight">{document.document_number}</h2>
          <div className="doc-status mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider">{humanizeStatus(document.status)}</div>
        </div>
      </header>

      <section className="doc-info-grid mb-8 grid gap-5 sm:grid-cols-[1fr_280px]">
        <div className="doc-bill-card p-5">
          <p className="doc-section-label mb-2 text-[10px] font-black uppercase tracking-[.18em]">{isInvoice ? "Bill to" : "Quotation for"}</p>
          <h3 className="doc-customer-name text-lg font-black">{customer.name}</h3>
          {customer.contact_person && <p className="mt-1 text-sm font-medium">Attn: {customer.contact_person}</p>}
          <div className="doc-muted mt-2 whitespace-pre-line text-sm leading-6">
            {customer.billing_address}
            {customer.email && <><br />{customer.email}</>}
            {customer.phone && <><br />{customer.phone}</>}
          </div>
          {customer.tax_number && <p className="mt-2 text-xs">Tax/VAT: {customer.tax_number}</p>}
        </div>

        <div className="doc-meta-card grid content-start gap-2 p-5 text-sm">
          <div className="flex justify-between gap-6"><span className="doc-muted">Issue date</span><strong>{document.issue_date}</strong></div>
          <div className="flex justify-between gap-6"><span className="doc-muted">{isInvoice ? "Due date" : "Valid until"}</span><strong>{isInvoice ? document.due_date : document.valid_until}</strong></div>
          <div className="flex justify-between gap-6"><span className="doc-muted">Currency</span><strong>{document.currency}</strong></div>
          {!isInvoice && document.project_reference && <div className="mt-2 border-t border-current/10 pt-3">
            <span className="doc-muted block text-xs">Project / Reference</span>
            <strong className="mt-1 block break-words leading-5">{document.project_reference}</strong>
          </div>}
          {isInvoice && <div className="doc-amount-due mt-2 pt-3"><div className="flex justify-between gap-6"><span className="font-bold doc-muted">{isPaid ? "Paid total" : "Amount due"}</span><strong className="doc-total-accent text-base">{formatMoney(document.grand_total, document.currency)}</strong></div></div>}
        </div>
      </section>

      <div className="doc-table-wrap">
        <table className="print-table doc-table w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="doc-col-product" />
            <col className="doc-col-description" />
            <col className="doc-col-qty" />
            <col className="doc-col-unit" />
            <col className="doc-col-rate" />
            <col className="doc-col-amount" />
          </colgroup>
          <thead><tr className="doc-table-head text-left text-[10px] uppercase tracking-wider"><th className="doc-th-product p-3">Product</th><th className="doc-th-description p-3">Description</th><th className="p-3 text-right">Qty</th><th className="p-3">Unit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody>{items.map((item, index) => <tr key={item.id} className={index % 2 ? "doc-row-alt" : "doc-row"}>
            <td className="doc-cell doc-product p-3 align-top font-bold">{String(item.product_name ?? "").trim() || "—"}</td>
            <td className="doc-cell doc-description whitespace-pre-line p-3 align-top text-xs leading-5">{String(item.description ?? "").trim()}</td>
            <td className="doc-cell p-3 text-right align-top money">{Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
            <td className="doc-cell p-3 align-top">{item.unit}</td>
            <td className="doc-cell p-3 text-right align-top money">{formatMoney(item.unit_price, document.currency)}</td>
            <td className="doc-cell p-3 text-right align-top font-bold money">{formatMoney(item.line_total, document.currency)}</td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="doc-totals totals-block ml-auto mt-7 w-full max-w-sm p-5 text-sm money">
        <div className="flex justify-between py-1.5"><span className="doc-muted">Subtotal</span><strong>{formatMoney(document.subtotal, document.currency)}</strong></div>
        {Number(document.discount_amount) > 0 && <div className="flex justify-between py-1.5"><span className="doc-muted">Discount{document.discount_type === "percentage" ? ` (${Number(document.discount_value)}%)` : ""}</span><strong>- {formatMoney(document.discount_amount, document.currency)}</strong></div>}
        <div className="flex justify-between py-1.5"><span className="doc-muted">Tax / VAT ({Number(document.tax_rate)}%)</span><strong>{formatMoney(document.tax_amount, document.currency)}</strong></div>
        <div className="doc-grand-total mt-3 flex justify-between pt-4 text-xl"><span className="font-black">{isInvoice ? "Grand total" : "Quoted total"}</span><strong>{formatMoney(document.grand_total, document.currency)}</strong></div>
      </div>

      {(document.notes || (isInvoice && company.bank_details) || (!isInvoice && document.terms)) && <section className="doc-footer-grid print-keep mt-10 grid gap-5 pt-6 sm:grid-cols-2">
        {document.notes && <div className="doc-soft-card p-4"><p className="doc-section-label text-[10px] font-black uppercase tracking-wider">Notes</p><p className="mt-2 whitespace-pre-line text-sm leading-6">{document.notes}</p></div>}
        {!isInvoice && document.terms && <div className="doc-soft-card p-4"><p className="doc-section-label text-[10px] font-black uppercase tracking-wider">Terms & conditions</p><p className="mt-2 whitespace-pre-line text-sm leading-6">{document.terms}</p></div>}
        {isInvoice && company.bank_details && <div className="doc-payment-card p-4"><p className="doc-section-label text-[10px] font-black uppercase tracking-wider">Payment details</p><p className="mt-2 whitespace-pre-line text-sm leading-6">{company.bank_details}</p></div>}
      </section>}

      {isInvoice && <section className="doc-authorization-row print-keep">
        <div className="doc-terms-panel">
          <p className="doc-section-label text-[10px] font-black uppercase tracking-wider">Terms & conditions</p>
          {document.terms && <p className="mt-2 whitespace-pre-line text-sm leading-6">{document.terms}</p>}
        </div>
        {showAuthorizedSignature && <div className="doc-signature-panel" aria-label="Authorized Signature">
          {signatureUrl && <div className="doc-signature-image-wrap"><img src={signatureUrl} alt="Authorized signature" className="doc-signature-image" /></div>}
          <div className="doc-signature-line" />
          <div className="doc-signature-label">Authorized Signature</div>
        </div>}
      </section>}

      <footer className="doc-bottom-footer print-keep">
        {isInvoice ? <div className="doc-thanks-message">Thank you for your business.</div> : <div className="doc-thanks-message">Thank you for considering our quotation.</div>}
        {showDocumentCredit && <div className="doc-brand-credit">{documentCreditText.trim() || "Powered by JasimFlow · by Jasim"}</div>}
      </footer>
    </div>
  </article>;
}

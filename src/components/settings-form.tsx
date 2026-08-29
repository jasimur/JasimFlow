"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Database, ImagePlus, Save, Trash2, Upload } from "lucide-react";
import { removeAuthorizedSignature, removeBusinessLogo, saveBusinessSettings, seedDemoData, uploadAuthorizedSignature, uploadBusinessLogo } from "@/actions/settings";
import { useToast } from "@/components/toast";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import type { Business } from "@/lib/types";

const currencies = ["USD", "EUR", "GBP", "BDT", "AED", "SAR", "INR", "CAD", "AUD", "JPY", "CHF", "SGD"];

export function SettingsForm({ business }: { business: Business }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const [currency, setCurrency] = useState(business.currency);
  const [showDocumentCredit, setShowDocumentCredit] = useState(business.show_document_credit ?? true);
  const [showAuthorizedSignature, setShowAuthorizedSignature] = useState(business.show_authorized_signature ?? true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(business.logo_url);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [localSignatureUrl, setLocalSignatureUrl] = useState<string | null>(business.signature_url);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const signaturePreviewObjectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    if (signaturePreviewObjectUrl.current) URL.revokeObjectURL(signaturePreviewObjectUrl.current);
  }, []);

  function chooseLogoFile(file: File | null) {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    previewObjectUrl.current = file ? URL.createObjectURL(file) : null;
    setLogoFile(file);
    setPreviewUrl(previewObjectUrl.current);
  }

  function chooseSignatureFile(file: File | null) {
    if (signaturePreviewObjectUrl.current) URL.revokeObjectURL(signaturePreviewObjectUrl.current);
    signaturePreviewObjectUrl.current = file ? URL.createObjectURL(file) : null;
    setSignatureFile(file);
    setSignaturePreviewUrl(signaturePreviewObjectUrl.current);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      ...Object.fromEntries(f.entries()),
      show_document_credit: f.get("show_document_credit") === "on",
      show_authorized_signature: f.get("show_authorized_signature") === "on"
    };
    startTransition(async () => {
      const r = await saveBusinessSettings(input);
      if (!r.ok) {
        show(r.error, "error");
        return;
      }
      show("Company settings saved", "success");
      router.refresh();
    });
  }

  function uploadLogo() {
    if (!logoFile) {
      show("Choose a logo image first", "error");
      return;
    }
    const data = new FormData();
    data.set("logo", logoFile);
    startTransition(async () => {
      const result = await uploadBusinessLogo(data);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setLocalLogoUrl(result.logoUrl);
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
      setPreviewUrl(null);
      setLogoFile(null);
      show("Company logo uploaded", "success");
      router.refresh();
    });
  }

  function removeLogo() {
    startTransition(async () => {
      const result = await removeBusinessLogo();
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
      setPreviewUrl(null);
      setLogoFile(null);
      setLocalLogoUrl(null);
      show("Company logo removed", "success");
      router.refresh();
    });
  }

  function uploadSignature() {
    if (!signatureFile) {
      show("Choose a signature image first", "error");
      return;
    }
    const data = new FormData();
    data.set("signature", signatureFile);
    startTransition(async () => {
      const result = await uploadAuthorizedSignature(data);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      setLocalSignatureUrl(result.signatureUrl);
      if (signaturePreviewObjectUrl.current) URL.revokeObjectURL(signaturePreviewObjectUrl.current);
      signaturePreviewObjectUrl.current = null;
      setSignaturePreviewUrl(null);
      setSignatureFile(null);
      show("Authorized signature uploaded", "success");
      router.refresh();
    });
  }

  function removeSignature() {
    startTransition(async () => {
      const result = await removeAuthorizedSignature();
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      if (signaturePreviewObjectUrl.current) URL.revokeObjectURL(signaturePreviewObjectUrl.current);
      signaturePreviewObjectUrl.current = null;
      setSignaturePreviewUrl(null);
      setSignatureFile(null);
      setLocalSignatureUrl(null);
      show("Authorized signature removed", "success");
      router.refresh();
    });
  }

  const shownLogo = previewUrl ?? localLogoUrl;
  const shownSignature = signaturePreviewUrl ?? localSignatureUrl;

  return <form onSubmit={submit} className="grid gap-5">
    <Card>
      <h2 className="mb-4 text-lg font-bold">Company identity</h2>
      <div className="mb-5 grid gap-4 rounded-xl border border-[var(--rule)] bg-[#faf9f6] p-4 sm:grid-cols-[112px_1fr] sm:items-center">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
          {shownLogo ? <img src={shownLogo} alt="Company logo preview" className="h-full w-full object-contain p-2" /> : <div className="text-center text-slate-400"><ImagePlus className="mx-auto" size={28}/><span className="mt-2 block text-xs">No logo</span></div>}
        </div>
        <div>
          <Label>Company logo</Label>
          <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => chooseLogoFile(e.target.files?.[0] ?? null)} />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Upload PNG, JPG/JPEG, or WebP. Maximum 2 MB. New or subsequently saved quotations/invoices will capture this logo in their document snapshot and show it in print/PDF output.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={uploadLogo} disabled={pending || !logoFile}><Upload size={16}/>Upload logo</Button>
            {localLogoUrl && <Button type="button" variant="ghost" className="text-red-700" onClick={removeLogo} disabled={pending}><Trash2 size={16}/>Remove logo</Button>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Business name</Label><Input name="name" defaultValue={business.name} required /></div>
        <div><Label>Email</Label><Input name="email" type="email" defaultValue={business.email ?? ""} /></div>
        <div><Label>Phone</Label><Input name="phone" defaultValue={business.phone ?? ""} /></div>
        <div><Label>Website</Label><Input name="website" type="url" defaultValue={business.website ?? ""} /></div>
        <div><Label>TAX / VAT number</Label><Input name="tax_number" defaultValue={business.tax_number ?? ""} /></div>
      </div>
      <div className="mt-4"><Label>Address</Label><Textarea name="address" defaultValue={business.address ?? ""} /></div>
    </Card>

    <Card>
      <h2 className="mb-4 text-lg font-bold">Billing defaults</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label>Currency</Label><Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>{currencies.map((c) => <option key={c}>{c}</option>)}</Select></div>
        <div><Label>Default tax %</Label><Input name="default_tax_rate" type="number" min="0" max="100" step="0.0001" defaultValue={business.default_tax_rate} /></div>
        <div><Label>Quotation prefix</Label><Input name="quotation_prefix" defaultValue={business.quotation_prefix} required /></div>
        <div><Label>Invoice prefix</Label><Input name="invoice_prefix" defaultValue={business.invoice_prefix} required /></div>
      </div>
      <div className="mt-4"><Label>Bank / payment details</Label><Textarea name="bank_details" defaultValue={business.bank_details ?? ""} /></div>
    </Card>

    <Card>
      <h2 className="mb-1 text-lg font-bold">Default Terms & Conditions</h2>
      <p className="mb-4 text-sm leading-6 text-[var(--muted)]">Keep separate defaults for each document type. New invoices and quotations start with the matching text automatically, and you can still edit the terms on any individual document.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label>Default Invoice Terms & Conditions</Label>
          <Textarea name="default_invoice_terms" rows={7} defaultValue={business.default_invoice_terms ?? ""} placeholder="Example: Payment due within 7 days. Product warranty is subject to manufacturer terms…" />
        </div>
        <div>
          <Label>Default Quotation Terms & Conditions</Label>
          <Textarea name="default_quotation_terms" rows={7} defaultValue={business.default_quotation_terms ?? ""} placeholder="Example: Quotation valid for 15 days. Prices may change after validity expires…" />
        </div>
      </div>
    </Card>


    <Card>
      <h2 className="mb-1 text-lg font-bold">Invoice authorization</h2>
      <p className="mb-4 text-sm leading-6 text-[var(--muted)]">Use a clean signature line at the lower-right of invoices. Terms & conditions remain on the lower-left.</p>
      <div className="rounded-xl border border-[var(--rule)] bg-[#faf9f6] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="show_authorized_signature"
            checked={showAuthorizedSignature}
            onChange={(e) => setShowAuthorizedSignature(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--navy)]"
          />
          <span>
            <span className="block text-sm font-bold">Show Authorized Signature on invoices</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">When enabled, invoices show the uploaded signature (if available), a signature line and the label “Authorized Signature”.</span>
          </span>
        </label>

        <div className="mt-5 grid gap-4 border-t border-[var(--rule)] pt-5 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="flex h-24 items-end justify-center rounded-xl border border-dashed border-slate-300 bg-white p-3">
            {shownSignature ? <img src={shownSignature} alt="Authorized signature preview" className="max-h-16 max-w-full object-contain" /> : <div className="pb-2 text-center text-xs text-slate-400">No signature uploaded</div>}
          </div>
          <div>
            <Label>Signature image</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => chooseSignatureFile(e.target.files?.[0] ?? null)} />
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">PNG with a transparent background gives the cleanest result. JPG/JPEG and WebP also work. Maximum 1 MB.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={uploadSignature} disabled={pending || !signatureFile}><Upload size={16}/>Upload signature</Button>
              {localSignatureUrl && <Button type="button" variant="ghost" className="text-red-700" onClick={removeSignature} disabled={pending}><Trash2 size={16}/>Remove signature</Button>}
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card>
      <h2 className="mb-1 text-lg font-bold">Document footer</h2>
      <p className="mb-4 text-sm leading-6 text-[var(--muted)]">Invoices always keep “Thank you for your business.” at the bottom. You can optionally show a small JasimFlow credit underneath on invoices and quotations.</p>
      <div className="rounded-xl border border-[var(--rule)] bg-[#faf9f6] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="show_document_credit"
            checked={showDocumentCredit}
            onChange={(e) => setShowDocumentCredit(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--navy)]"
          />
          <span>
            <span className="block text-sm font-bold">Show JasimFlow credit on documents</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Turn this off whenever you want a completely white-label quotation or invoice.</span>
          </span>
        </label>
        <div className="mt-4">
          <Label>Credit text</Label>
          <Input
            name="document_credit_text"
            maxLength={160}
            defaultValue={business.document_credit_text || "Powered by JasimFlow · by Jasim"}
            readOnly={!showDocumentCredit}
            className={!showDocumentCredit ? "bg-slate-100 text-slate-500" : undefined}
          />
          <p className="mt-2 text-xs text-[var(--muted)]">Recommended: Powered by JasimFlow · by Jasim</p>
        </div>
      </div>
    </Card>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="secondary" onClick={() => startTransition(async () => { const r = await seedDemoData(); show(r.ok ? "Demo data added (or already present)" : r.error, r.ok ? "success" : "error"); })}><Database size={17}/>Seed demo data</Button>
      <Button type="submit" disabled={pending}><Save size={17}/>{pending ? "Saving…" : "Save settings"}</Button>
    </div>
  </form>;
}

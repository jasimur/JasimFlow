"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, FileOutput, Pencil, Printer, RotateCcw, Share2, Trash2 } from "lucide-react";
import { convertQuotation, deleteDocument, duplicateDocument, setDocumentStatus } from "@/actions/documents";
import { useToast } from "@/components/toast";
import { Button, ConfirmDialog } from "@/components/ui";
import type { DocumentRecord } from "@/lib/types";

type Html2PdfWorker = {
  set(options: unknown): Html2PdfWorker;
  from(element: HTMLElement): Html2PdfWorker;
  outputPdf(type: "blob"): Promise<Blob>;
};
type Html2PdfFactory = () => Html2PdfWorker;

declare global {
  interface Window {
    html2pdf?: Html2PdfFactory;
  }
}

let pdfEnginePromise: Promise<Html2PdfFactory> | null = null;

function loadPdfEngine(): Promise<Html2PdfFactory> {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (pdfEnginePromise) return pdfEnginePromise;

  pdfEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jasimflow-pdf="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error("PDF engine unavailable")), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF engine failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
    script.async = true;
    script.dataset.jasimflowPdf = "true";
    script.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error("PDF engine unavailable"));
    script.onerror = () => reject(new Error("PDF engine failed to load"));
    document.head.appendChild(script);
  });

  return pdfEnginePromise;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

async function createPdfBlob(documentNumber: string) {
  const element = document.getElementById("jasimflow-document");
  if (!element) throw new Error("Document preview not found");
  const html2pdf = await loadPdfEngine();
  const worker = html2pdf().set({
    margin: [10, 10, 10, 10],
    filename: `${safeFileName(documentNumber)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  }).from(element);
  return worker.outputPdf("blob");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function DocumentActions({ document }: { document: DocumentRecord }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState<"download" | "share" | null>(null);
  const base = document.document_type === "quotation" ? "quotations" : "invoices";
  const pdfName = `${safeFileName(document.document_number)}.pdf`;

  function duplicate() { startTransition(async () => { const r = await duplicateDocument(document.id); if (!r.ok) { show(r.error, "error"); return; } show("Duplicate created", "success"); router.push(`/${base}/${r.id}/edit`); }); }
  function convert() { startTransition(async () => { const r = await convertQuotation(document.id); if (!r.ok) { show(r.error, "error"); return; } show(r.alreadyExisted ? "This quotation was already converted; opening the existing invoice." : "Invoice created from quotation", "success"); router.push(`/invoices/${r.id}`); }); }
  function status(next: string) { startTransition(async () => { const r = await setDocumentStatus(document.id, next); if (!r.ok) { show(r.error, "error"); return; } show(`Status changed to ${next}`, "success"); router.refresh(); }); }
  function remove() { startTransition(async () => { const r = await deleteDocument(document.id); if (!r.ok) { show(r.error, "error"); return; } show("Document deleted", "success"); router.push(`/${base}`); }); }

  async function downloadPdf() {
    setExporting("download");
    try {
      const blob = await createPdfBlob(document.document_number);
      downloadBlob(blob, pdfName);
      show("PDF downloaded", "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not create PDF", "error");
    } finally {
      setExporting(null);
    }
  }

  async function shareDocument() {
    setExporting("share");
    try {
      const blob = await createPdfBlob(document.document_number);
      const file = new File([blob], pdfName, { type: "application/pdf" });
      const shareData = { title: document.document_number, text: `${document.document_type === "invoice" ? "Invoice" : "Quotation"} ${document.document_number}`, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: document.document_number, text: shareData.text, url: window.location.href });
        return;
      }
      downloadBlob(blob, pdfName);
      show("Sharing is not supported on this browser, so the PDF was downloaded instead.", "info");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      show(error instanceof Error ? error.message : "Could not share document", "error");
    } finally {
      setExporting(null);
    }
  }

  return <>
    <div className="document-action-bar flex flex-wrap gap-2 no-print">
      <Button type="button" onClick={downloadPdf} disabled={!!exporting}><Download size={16}/>{exporting === "download" ? "Creating PDF…" : "Download PDF"}</Button>
      <Button type="button" variant="secondary" onClick={shareDocument} disabled={!!exporting}><Share2 size={16}/>{exporting === "share" ? "Preparing…" : "Share"}</Button>
      <Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={16}/>Print</Button>
      <Button type="button" variant="secondary" onClick={() => router.push(`/${base}/${document.id}/edit`)}><Pencil size={16}/>Edit</Button>
      <Button type="button" variant="secondary" onClick={duplicate} disabled={pending}><Copy size={16}/>Duplicate</Button>
      {document.document_type === "quotation" && <Button type="button" onClick={convert} disabled={pending}><FileOutput size={16}/>Convert to invoice</Button>}
      {document.document_type === "invoice" && document.status !== "paid" && <Button type="button" onClick={() => status("paid")} disabled={pending}><CheckCircle2 size={16}/>Mark paid</Button>}
      {document.document_type === "invoice" && document.status === "paid" && <Button type="button" variant="secondary" onClick={() => status("unpaid")} disabled={pending}><RotateCcw size={16}/>Mark unpaid</Button>}
      <Button type="button" variant="ghost" className="text-red-700" onClick={() => setConfirmDelete(true)}><Trash2 size={16}/>Delete</Button>
    </div>
    <ConfirmDialog open={confirmDelete} title={`Delete ${document.document_number}?`} message="This permanently deletes this document and its line items. This action cannot be undone." onCancel={() => setConfirmDelete(false)} onConfirm={remove} busy={pending}/>
  </>;
}

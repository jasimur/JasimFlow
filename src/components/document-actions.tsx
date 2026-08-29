"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, FileOutput, Pencil, Printer, RotateCcw, Share2, Trash2 } from "lucide-react";
import { convertQuotation, deleteDocument, duplicateDocument, setDocumentStatus } from "@/actions/documents";
import { useToast } from "@/components/toast";
import { Button, ConfirmDialog } from "@/components/ui";
import type { DocumentRecord } from "@/lib/types";

type Html2CanvasOptions = {
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  backgroundColor?: string | null;
  logging?: boolean;
  scrollX?: number;
  scrollY?: number;
  windowWidth?: number;
  windowHeight?: number;
};

type Html2CanvasFactory = (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;

type JsPdfInstance = {
  addPage(): void;
  addImage(imageData: string, format: "PNG" | "JPEG", x: number, y: number, width: number, height: number, alias?: string, compression?: string): void;
  output(type: "blob"): Blob;
};

type JsPdfConstructor = new (options?: {
  orientation?: "portrait" | "landscape";
  unit?: "mm";
  format?: "a4";
  compress?: boolean;
}) => JsPdfInstance;

declare global {
  interface Window {
    html2canvas?: Html2CanvasFactory | { default?: Html2CanvasFactory };
    jspdf?: { jsPDF?: JsPdfConstructor };
  }
}

const PDF_ENGINE_TIMEOUT_MS = 45_000;
const IMAGE_WAIT_TIMEOUT_MS = 8_000;
const PDF_MARGIN_MM = 10;
const PDF_CONTENT_WIDTH_MM = 190;
const PDF_CONTENT_HEIGHT_MM = 277;

const scriptPromises = new Map<string, Promise<void>>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function loadScript(src: string, key: string): Promise<void> {
  const cached = scriptPromises.get(key);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-jasimflow-lib="${key}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`${key} failed to load`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.jasimflowLib = key;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`${key} failed to load`)), { once: true });
    document.head.appendChild(script);
  });

  scriptPromises.set(key, promise);
  return promise;
}

function getHtml2Canvas(): Html2CanvasFactory {
  const candidate = window.html2canvas;
  if (typeof candidate === "function") return candidate;
  if (candidate && typeof candidate.default === "function") return candidate.default;
  throw new Error("PDF renderer is unavailable");
}

function getJsPdf(): JsPdfConstructor {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error("PDF writer is unavailable");
  return jsPDF;
}

async function loadPdfEngines() {
  // html2canvas-pro 1.6.7 is deliberately pinned. It understands Tailwind 4's
  // modern CSS colour functions while retaining reliable CSS backgrounds/gradients.
  await Promise.all([
    loadScript("https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.7/dist/html2canvas-pro.min.js", "html2canvas-pro"),
    loadScript("https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js", "jspdf"),
  ]);
  return { html2canvas: getHtml2Canvas(), jsPDF: getJsPdf() };
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const pending = images.filter((image) => !image.complete);
  if (!pending.length) return Promise.resolve();

  return Promise.all(pending.map((image) => new Promise<void>((resolve) => {
    const finish = () => resolve();
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  }))).then(() => undefined);
}

function createExportClone(source: HTMLElement) {
  const root = document.createElement("div");
  root.className = "jasimflow-pdf-export-root";
  root.setAttribute("aria-hidden", "true");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.classList.add("jasimflow-pdf-export-sheet");
  root.appendChild(clone);
  document.body.appendChild(root);
  return { root, clone };
}

function canvasSliceToDataUrl(source: HTMLCanvasElement, startY: number, height: number) {
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = source.width;
  pageCanvas.height = height;
  const context = pageCanvas.getContext("2d");
  if (!context) throw new Error("Could not prepare PDF page");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  context.drawImage(source, 0, startY, source.width, height, 0, 0, source.width, height);
  return pageCanvas.toDataURL("image/jpeg", 0.96);
}

async function createPdfBlob() {
  const source = document.getElementById("jasimflow-document");
  if (!source) throw new Error("Document preview not found");

  const { html2canvas, jsPDF } = await withTimeout(loadPdfEngines(), 15_000, "PDF tools took too long to load. Check your internet connection and try again.");
  const { root, clone } = createExportClone(source);

  try {
    if (document.fonts?.ready) await withTimeout(document.fonts.ready, 5_000, "Fonts took too long to prepare").catch(() => undefined);
    await withTimeout(waitForImages(clone), IMAGE_WAIT_TIMEOUT_MS, "Images took too long to prepare").catch(() => undefined);

    const canvas = await withTimeout(
      html2canvas(clone, {
        scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)),
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(1200, clone.scrollWidth),
        windowHeight: Math.max(1600, clone.scrollHeight),
      }),
      PDF_ENGINE_TIMEOUT_MS,
      "PDF generation timed out. Please try again.",
    );

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pixelsPerMm = canvas.width / PDF_CONTENT_WIDTH_MM;
    const maxPageHeightPx = Math.max(1, Math.floor(PDF_CONTENT_HEIGHT_MM * pixelsPerMm));

    let startY = 0;
    let pageIndex = 0;
    while (startY < canvas.height) {
      const sliceHeight = Math.min(maxPageHeightPx, canvas.height - startY);
      if (pageIndex > 0) pdf.addPage();
      const pageImage = canvasSliceToDataUrl(canvas, startY, sliceHeight);
      const renderedHeightMm = sliceHeight / pixelsPerMm;
      pdf.addImage(pageImage, "JPEG", PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_CONTENT_WIDTH_MM, renderedHeightMm, undefined, "FAST");
      startY += sliceHeight;
      pageIndex += 1;
    }

    return pdf.output("blob");
  } finally {
    root.remove();
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
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
    if (exporting) return;
    setExporting("download");
    try {
      const blob = await createPdfBlob();
      downloadBlob(blob, pdfName);
      show("PDF downloaded", "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Could not create PDF", "error");
    } finally {
      setExporting(null);
    }
  }

  async function shareDocument() {
    if (exporting) return;
    setExporting("share");
    try {
      const blob = await createPdfBlob();
      const file = new File([blob], pdfName, { type: "application/pdf" });
      const shareText = `${document.document_type === "invoice" ? "Invoice" : "Quotation"} ${document.document_number}`;
      const shareData: ShareData = { title: document.document_number, text: shareText, files: [file] };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: document.document_number, text: shareText, url: window.location.href });
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

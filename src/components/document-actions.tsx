"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileOutput, Pencil, Printer, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { convertQuotation, deleteDocument, duplicateDocument, setDocumentStatus } from "@/actions/documents";
import { useToast } from "@/components/toast";
import { Button, ConfirmDialog } from "@/components/ui";
import type { DocumentRecord } from "@/lib/types";

export function DocumentActions({ document }: { document: DocumentRecord }) {
  const router=useRouter(); const {show}=useToast(); const [pending,startTransition]=useTransition(); const [confirmDelete,setConfirmDelete]=useState(false);
  const base=document.document_type==="quotation"?"quotations":"invoices";
  function duplicate(){startTransition(async()=>{const r=await duplicateDocument(document.id);if(!r.ok){show(r.error,"error");return;}show("Duplicate created","success");router.push(`/${base}/${r.id}/edit`);});}
  function convert(){startTransition(async()=>{const r=await convertQuotation(document.id);if(!r.ok){show(r.error,"error");return;}show(r.alreadyExisted?"This quotation was already converted; opening the existing invoice.":"Invoice created from quotation","success");router.push(`/invoices/${r.id}`);});}
  function status(next:string){startTransition(async()=>{const r=await setDocumentStatus(document.id,next);if(!r.ok){show(r.error,"error");return;}show(`Status changed to ${next}`,"success");router.refresh();});}
  function remove(){startTransition(async()=>{const r=await deleteDocument(document.id);if(!r.ok){show(r.error,"error");return;}show("Document deleted","success");router.push(`/${base}`);});}
  return <><div className="flex flex-wrap gap-2 no-print"><Button type="button" variant="secondary" onClick={()=>router.push(`/${base}/${document.id}/edit`)}><Pencil size={16}/>Edit</Button><Button type="button" variant="secondary" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</Button><Button type="button" variant="secondary" onClick={duplicate} disabled={pending}><Copy size={16}/>Duplicate</Button>{document.document_type==="quotation"&&<Button type="button" onClick={convert} disabled={pending}><FileOutput size={16}/>Convert to invoice</Button>}{document.document_type==="invoice"&&document.status!=="paid"&&<Button type="button" onClick={()=>status("paid")} disabled={pending}><CheckCircle2 size={16}/>Mark paid</Button>}{document.document_type==="invoice"&&document.status==="paid"&&<Button type="button" variant="secondary" onClick={()=>status("unpaid")} disabled={pending}><RotateCcw size={16}/>Mark unpaid</Button>}<Button type="button" variant="ghost" className="text-red-700" onClick={()=>setConfirmDelete(true)}><Trash2 size={16}/>Delete</Button></div><ConfirmDialog open={confirmDelete} title={`Delete ${document.document_number}?`} message="This permanently deletes this document and its line items. This action cannot be undone." onCancel={()=>setConfirmDelete(false)} onConfirm={remove} busy={pending}/></>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentActions } from "@/components/document-actions";
import { DocumentPreview } from "@/components/document-preview";
import { PageHeader } from "@/components/page-header";
import { getBusiness, getDocument } from "@/lib/data";
export default async function InvoicePreviewPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const [document,business]=await Promise.all([getDocument(id),getBusiness()]);if(!document||document.document_type!=="invoice")notFound();return <><div className="no-print"><PageHeader title={document.document_number} description="Invoice preview and print layout." actions={<Link className="btn btn-secondary" href="/invoices"><ArrowLeft size={16}/>Back</Link>}/><div className="mb-5"><DocumentActions document={document}/></div></div><DocumentPreview document={document} showDocumentCredit={business.show_document_credit} documentCreditText={business.document_credit_text} showAuthorizedSignature={business.show_authorized_signature} signatureUrl={business.signature_url}/></>}

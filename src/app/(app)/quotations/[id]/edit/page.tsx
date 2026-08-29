import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/document-editor";
import { PageHeader } from "@/components/page-header";
import { getBusiness, getCatalogItems, getCustomers, getDocument } from "@/lib/data";
export default async function EditQuotationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const [document,business,customers,items]=await Promise.all([getDocument(id),getBusiness(),getCustomers(),getCatalogItems()]);if(!document||document.document_type!=="quotation")notFound();return <><PageHeader title={`Edit ${document.document_number}`} description="Changes update this quotation while keeping its document number."/><DocumentEditor type="quotation" business={business} customers={customers} catalogItems={items} document={document}/></>}

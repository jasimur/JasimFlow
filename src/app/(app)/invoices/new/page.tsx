import { DocumentEditor } from "@/components/document-editor";
import { PageHeader } from "@/components/page-header";
import { getBusiness, getCatalogItems, getCustomers, getDocumentNumberSuggestion } from "@/lib/data";

export default async function NewInvoicePage() {
  const [business, customers, items] = await Promise.all([getBusiness(), getCustomers(), getCatalogItems()]);
  const suggestedNumber = await getDocumentNumberSuggestion("invoice", business);
  return <>
    <PageHeader title="New invoice" description="Create an invoice with authoritative server-side totals." />
    <DocumentEditor type="invoice" business={business} customers={customers} catalogItems={items} suggestedNumber={suggestedNumber} />
  </>;
}

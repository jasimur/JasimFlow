import { DocumentEditor } from "@/components/document-editor";
import { PageHeader } from "@/components/page-header";
import { getBusiness, getCatalogItems, getCustomers } from "@/lib/data";
export default async function NewQuotationPage(){const [business,customers,items]=await Promise.all([getBusiness(),getCustomers(),getCatalogItems()]);return <><PageHeader title="New quotation" description="Draft a professional quotation. Numbering is assigned when saved."/><DocumentEditor type="quotation" business={business} customers={customers} catalogItems={items}/></>}

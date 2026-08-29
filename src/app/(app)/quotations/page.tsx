import Link from "next/link";
import { Plus } from "lucide-react";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { getDocuments } from "@/lib/data";
export default async function QuotationsPage(){const docs=await getDocuments("quotation");return <><PageHeader title="Quotations" description="Create, track and convert proposals into invoices." actions={<Link href="/quotations/new" className="btn btn-primary"><Plus size={16}/>New quotation</Link>}/><DocumentsTable documents={docs} type="quotation" today={new Date().toISOString().slice(0,10)}/></>}

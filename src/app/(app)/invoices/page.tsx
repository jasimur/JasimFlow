import Link from "next/link";
import { Plus } from "lucide-react";
import { DocumentsTable } from "@/components/documents-table";
import { PageHeader } from "@/components/page-header";
import { getDocuments } from "@/lib/data";
export default async function InvoicesPage(){const docs=await getDocuments("invoice");return <><PageHeader title="Invoices" description="Issue, track, print and mark invoices paid." actions={<Link href="/invoices/new" className="btn btn-primary"><Plus size={16}/>New invoice</Link>}/><DocumentsTable documents={docs} type="invoice" today={new Date().toISOString().slice(0,10)}/></>}

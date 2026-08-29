import { CustomerManager } from "@/components/customer-manager";
import { PageHeader } from "@/components/page-header";
import { getCustomers } from "@/lib/data";
export default async function CustomersPage(){const customers=await getCustomers();return <><PageHeader title="Customers" description="Manage billing contacts. Saved documents keep historical snapshots."/><CustomerManager customers={customers}/></>}

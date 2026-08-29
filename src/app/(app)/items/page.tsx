import { ItemManager } from "@/components/item-manager";
import { PageHeader } from "@/components/page-header";
import { getBusiness, getCatalogItems } from "@/lib/data";
export default async function ItemsPage(){const [items,business]=await Promise.all([getCatalogItems(),getBusiness()]);return <><PageHeader title="Items / Services" description="Save reusable CCTV / IT products, specifications and rates, or use custom lines on any document."/><ItemManager items={items} currency={business.currency}/></>}

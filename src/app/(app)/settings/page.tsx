import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { getBusiness } from "@/lib/data";
export default async function SettingsPage(){const business=await getBusiness();return <><PageHeader title="Company settings" description="Identity, numbering, tax defaults and payment details."/><SettingsForm business={business}/></>}

import { AppShell } from "@/components/app-shell";
import { getBusiness } from "@/lib/data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const business = await getBusiness();
  return <AppShell businessName={business.name}>{children}</AppShell>;
}

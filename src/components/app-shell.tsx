"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FileText, Gauge, Menu, Package, ReceiptText, Settings, Users, X, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { classNames } from "@/lib/utils";

const links = [
  ["/dashboard", "Dashboard", Gauge],
  ["/quotations", "Quotations", FileText],
  ["/invoices", "Invoices", ReceiptText],
  ["/customers", "Customers", Users],
  ["/items", "Items / Services", Package],
  ["/settings", "Settings", Settings]
] as const;

export function AppShell({ businessName, children }: { businessName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <>
      <div className="flex h-18 items-center justify-between border-b border-white/10 px-5">
        <Link href="/dashboard" className="font-black tracking-tight text-white">Jasim<span className="text-[var(--accent-light)]">Flow</span></Link>
        <button type="button" className="rounded-md p-1 text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20}/></button>
      </div>
      <div className="px-4 py-5">
        <div className="mb-5 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Business</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{businessName}</p>
        </div>
        <nav className="grid gap-1">
          {links.map(([href,label,Icon]) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={classNames("nav-link", active && "nav-link-active")}><Icon size={18}/><span>{label}</span></Link>;
          })}
        </nav>
      </div>
      <form action={logoutAction} className="mt-auto border-t border-white/10 p-4">
        <button type="submit" className="nav-link w-full"><LogOut size={18}/><span>Sign out</span></button>
      </form>
    </>
  );
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[var(--navy)] lg:flex no-print">{nav}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden no-print"><button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close navigation"/><aside className="relative flex h-full w-72 flex-col bg-[var(--navy)] shadow-2xl">{nav}</aside></div>}
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[var(--rule)] bg-white/95 px-4 backdrop-blur lg:ml-64 lg:hidden no-print">
        <button type="button" className="rounded-lg border border-[var(--rule)] p-2" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
        <span className="ml-3 font-black">JasimFlow</span>
      </header>
      <main className="lg:ml-64"><div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div></main>
    </div>
  );
}

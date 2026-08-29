"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export interface DropdownItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; }

export function DropdownMenu({ items, trigger }: { items: DropdownItem[]; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, []);
  return <div ref={ref} className="relative inline-block text-left no-print">
    <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--ink)]" aria-haspopup="menu" aria-expanded={open}>{trigger ?? <MoreHorizontal size={18}/>}</button>
    {open && <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--rule)] bg-white py-1 shadow-xl">
      {items.map((item) => <button type="button" key={item.label} role="menuitem" disabled={item.disabled} onClick={() => { setOpen(false); item.onClick(); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-40 ${item.danger ? "text-red-700 hover:bg-red-50" : "hover:bg-slate-50"}`}>{item.icon}{item.label}</button>)}
    </div>}
  </div>;
}

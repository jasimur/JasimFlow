"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteCatalogItem, saveCatalogItem } from "@/actions/items";
import { useToast } from "@/components/toast";
import { Button, ConfirmDialog, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import type { CatalogItem } from "@/lib/types";

const units = ["pcs", "set", "box", "meter", "roll", "point", "device", "license", "job", "service", "hour", "day", "kg", "custom"];

export function ItemManager({ items, currency }: { items: CatalogItem[]; currency: string }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function begin(item?: CatalogItem) {
    setEditing(item ?? null);
    setOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      id: editing?.id,
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      default_unit: String(fd.get("default_unit") ?? "pcs"),
      default_rate: String(fd.get("default_rate") ?? "0")
    };
    startTransition(async () => {
      const result = await saveCatalogItem(input);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      show(editing ? "Product updated" : "Product created", "success");
      setOpen(false);
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteCatalogItem(deleting.id);
      if (!result.ok) {
        show(result.error, "error");
        return;
      }
      show("Catalog product deleted; saved documents are unchanged.", "success");
      setDeleting(null);
    });
  }

  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
      <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, models or services…" className="pl-9"/></div>
      <Button type="button" onClick={() => begin()}><Plus size={17}/>New product</Button>
    </div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Product / Service</th><th>Unit</th><th>Default rate</th><th className="w-28">Actions</th></tr></thead><tbody>{filtered.length === 0 ? <tr><td colSpan={4} className="text-center text-[var(--muted)]">No catalog products found.</td></tr> : filtered.map((item) => <tr key={item.id}><td><div className="font-bold">{item.name}</div><div className="max-w-2xl whitespace-pre-line text-xs text-[var(--muted)]">{item.description || "—"}</div></td><td>{item.default_unit}</td><td className="money">{currency} {Number(item.default_rate).toFixed(2)}</td><td><div className="flex gap-1"><button type="button" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => begin(item)} aria-label="Edit product"><Pencil size={16}/></button><button type="button" className="rounded-lg p-2 text-red-700 hover:bg-red-50" onClick={() => setDeleting(item)} aria-label="Delete product"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
    <Modal open={open} title={editing ? "Edit product / service" : "New product / service"} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="grid gap-4">
        <div><Label>Product / service name</Label><Input name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Hikvision 4MP IP Camera" required/></div>
        <div><Label>Description</Label><Textarea name="description" defaultValue={editing?.description ?? ""} placeholder="Model, warranty or other details"/></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Default unit</Label><Select name="default_unit" defaultValue={editing?.default_unit ?? "pcs"}>{units.map((unit) => <option key={unit}>{unit}</option>)}</Select></div><div><Label>Default rate ({currency})</Label><Input name="default_rate" type="number" min="0" step="0.0001" defaultValue={editing?.default_rate ?? "0"} required/></div></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save product"}</Button></div>
      </form>
    </Modal>
    <ConfirmDialog open={!!deleting} title="Delete product / service?" message="This removes it from the reusable catalog only. Existing quotation/invoice lines remain intact because product name, description, unit and rate are stored as snapshots." onCancel={() => setDeleting(null)} onConfirm={confirmDelete} busy={pending}/>
  </>;
}

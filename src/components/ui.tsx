"use client";

import { X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button type={type} className={classNames("btn", `btn-${variant}`, className)} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={classNames("field", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={classNames("field", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={classNames("field min-h-24 resize-y", props.className)} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-[var(--ink)]">{children}</label>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={classNames("rounded-xl border border-[var(--rule)] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "blue" }) {
  return <span className={classNames("badge", `badge-${tone}`)}>{children}</span>;
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--rule)] px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close"><X size={18}/></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onCancel, onConfirm, busy }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void; busy?: boolean }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm leading-6 text-[var(--muted)]">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : "Confirm"}</Button>
      </div>
    </Modal>
  );
}

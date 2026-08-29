import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[var(--paper)] p-4"><div className="max-w-md rounded-xl border border-[var(--rule)] bg-white p-7 text-center"><p className="text-xs font-black uppercase tracking-wider text-[var(--accent)]">404</p><h1 className="mt-2 text-2xl font-black">Document not found</h1><p className="mt-2 text-sm text-[var(--muted)]">The requested page does not exist or is not available to this account.</p><Link className="btn btn-primary mt-5" href="/dashboard">Back to dashboard</Link></div></main>;
}

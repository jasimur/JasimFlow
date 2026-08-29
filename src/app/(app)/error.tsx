"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6"><p className="text-xs font-black uppercase tracking-wider text-red-700">Something went wrong</p><h1 className="mt-2 text-2xl font-black">Unable to load this page</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{error.message || "An unexpected application error occurred."}</p><Button type="button" className="mt-5" onClick={reset}>Try again</Button></div>;
}

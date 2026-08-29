export default function Loading() {
  return <div className="animate-pulse"><div className="mb-6 h-8 w-56 rounded bg-slate-200"/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-32 rounded-xl border border-[var(--rule)] bg-white"/>)}</div><div className="mt-5 h-72 rounded-xl border border-[var(--rule)] bg-white"/></div>;
}

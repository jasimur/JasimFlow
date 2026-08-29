import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <main className="auth-grid grid min-h-screen place-items-center p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
      <div className="mb-7"><p className="text-sm font-black uppercase tracking-[.18em] text-[var(--accent)]">JasimFlow</p><h1 className="mt-2 text-3xl font-black">Welcome back</h1><p className="mt-2 text-sm text-[var(--muted)]">Sign in to manage quotations and invoices.</p></div>
      {params.error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{params.error}</div>}
      {params.message && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{params.message}</div>}
      <form action={loginAction} className="grid gap-4">
        <label className="text-sm font-semibold">Email<input className="field mt-1" name="email" type="email" required autoComplete="email"/></label>
        <label className="text-sm font-semibold">Password<PasswordInput name="password" required minLength={6} autoComplete="current-password"/></label>
        <button type="submit" className="btn btn-primary mt-1 w-full">Sign in</button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">New here? <Link className="font-bold text-[var(--navy)] underline" href="/signup">Create an account</Link></p>
    </div>
  </main>;
}

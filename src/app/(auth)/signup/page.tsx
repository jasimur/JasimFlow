import Link from "next/link";
import { signupAction } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="auth-grid grid min-h-screen place-items-center p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
      <div className="mb-7"><p className="text-sm font-black uppercase tracking-[.18em] text-[var(--accent)]">JasimFlow</p><h1 className="mt-2 text-3xl font-black">Create your workspace</h1><p className="mt-2 text-sm text-[var(--muted)]">One account, one business, clean billing.</p></div>
      {params.error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{params.error}</div>}
      <form action={signupAction} className="grid gap-4">
        <label className="text-sm font-semibold">Business name<input className="field mt-1" name="business_name" required maxLength={180}/></label>
        <label className="text-sm font-semibold">Email<input className="field mt-1" name="email" type="email" required autoComplete="email"/></label>
        <label className="text-sm font-semibold">Password<PasswordInput name="password" required minLength={6} autoComplete="new-password"/></label>
        <button type="submit" className="btn btn-primary mt-1 w-full">Create account</button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">Already have an account? <Link className="font-bold text-[var(--navy)] underline" href="/login">Sign in</Link></p>
    </div>
  </main>;
}

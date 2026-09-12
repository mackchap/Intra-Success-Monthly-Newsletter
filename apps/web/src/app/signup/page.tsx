import Link from "next/link";
import { signupAction } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; funnelId?: string; lead?: string }>;
}) {
  const { productId, funnelId, lead } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <form action={signupAction} className="flex flex-col gap-4">
        {productId && <input type="hidden" name="productId" value={productId} />}
        {funnelId && <input type="hidden" name="funnelId" value={funnelId} />}
        {lead && <input type="hidden" name="lead" value={lead} />}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" className="rounded-md border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" required className="rounded-md border border-slate-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white">
          {productId ? "Create account & continue to payment" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600">
          Sign in
        </Link>
      </p>
    </main>
  );
}

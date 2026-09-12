import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Thanks for your purchase!</h1>
      <p className="text-slate-600">
        We&apos;re finishing setting up your access now — it usually only takes a few seconds. Check your{" "}
        <Link href="/portal" className="text-brand-600">
          portal
        </Link>{" "}
        shortly.
      </p>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs tracking-widest text-faint uppercase">404</p>
      <h1 className="mt-3 font-serif text-5xl">This page isn&apos;t available</h1>
      <p className="mt-3 max-w-sm text-sm text-dim">The link may be mistyped, or the form is no longer accepting responses.</p>
      <Link href="/" className="btn-secondary mt-8">
        Go home
      </Link>
    </main>
  );
}

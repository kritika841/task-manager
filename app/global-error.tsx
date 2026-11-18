"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-red-500/10 text-red-400 font-mono text-lg font-bold border border-red-500/20">
            500
          </div>
          <h1 className="text-xl font-bold">Application Error</h1>
          <p className="text-sm text-zinc-400">
            A critical application error occurred. Reload to continue.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Reload
            </button>
            <Link
              href="/"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

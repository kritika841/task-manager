"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-float space-y-4">
        <div className="inline-flex items-center justify-center size-12 rounded-xl bg-destructive/10 text-destructive font-mono text-lg font-bold border border-destructive/20">
          500
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Something Went Wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. Please try again or return to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

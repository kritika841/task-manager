import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-float space-y-4">
        <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary font-mono text-lg font-bold border border-primary/20">
          404
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Page Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

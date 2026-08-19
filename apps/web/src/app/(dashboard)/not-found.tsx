import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-8xl font-bold tracking-tighter text-brand-500">404</p>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Page Not Found</h1>
          <p className="text-neutral-400">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

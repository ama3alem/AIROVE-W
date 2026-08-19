'use client';

import { useEffect } from 'react';

export default function DashboardLoading() {
  useEffect(() => {
    document.title = 'Loading... | AIROVE';
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="text-2xl font-bold tracking-tight text-white">
          AIROVE
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    </div>
  );
}

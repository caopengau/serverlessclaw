import React from 'react';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black font-mono text-red-500">
      <div className="flex flex-col items-center space-y-4 rounded-lg border border-red-500/20 bg-red-500/5 p-12 text-center">
        <ShieldAlert className="h-16 w-16" />
        <h1 className="text-2xl font-bold uppercase tracking-widest">Access Denied</h1>
        <p className="text-sm text-red-400/80">
          You do not have the required clearance level to access this sector.
        </p>
        <Link
          href="/"
          className="mt-6 border border-red-500/30 px-6 py-2 text-xs uppercase hover:bg-red-500/10 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

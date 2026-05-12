'use client';

import React from 'react';
import { useUser } from '@/components/Providers/UserProvider';
import { UserRole } from '@claw/core/lib/types/common';
import Typography from '@/components/ui/Typography';
import { ShieldAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: UserRole[];
  fallback?: React.ReactNode;
}

/**
 * RoleGuard restricts access to its children based on the current user's role.
 */
export default function RoleGuard({ children, requiredRoles, fallback }: RoleGuardProps) {
  const { user, loading } = useUser();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse">
        <Typography variant="mono" className="text-cyber-green/50 text-[10px] uppercase tracking-widest">
          Verifying Identity...
        </Typography>
      </div>
    );
  }

  const userRole = (user?.role as UserRole) || UserRole.MEMBER;

  // Owners always have access
  const hasAccess = userRole === UserRole.OWNER || requiredRoles.includes(userRole);

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-black/40 border border-white/5 rounded-sm glass-card">
        <div className="w-16 h-16 bg-red-500/10 rounded-sm flex items-center justify-center text-red-500 mb-6 border border-red-500/30">
          <ShieldAlert size={32} />
        </div>
        <Typography variant="h2" color="primary" glow uppercase className="mb-4">
          Access Denied
        </Typography>
        <Typography variant="mono" color="muted" className="max-w-md mb-8 text-xs uppercase leading-loose">
          Your current clearance level ({userRole}) is insufficient for this terminal. 
          Contact a system administrator to request an upgrade.
        </Typography>
        <Button onClick={() => router.push('/')} variant="outline" size="sm">
          Return to Neural Hub
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

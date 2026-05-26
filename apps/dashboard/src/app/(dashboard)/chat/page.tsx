'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ChatContent from '@/components/Chat/ChatContent';
import RoleGuard from '@/components/RoleGuard';
import { UserRole } from '@claw/core/lib/types/common';

/**
 * ChatPage — entry point for the Intelligence sector chat interface.
 * Now located at /chat to make room for the Mission Dashboard on Home.
 */
export default function ChatPage() {
  return (
    <RoleGuard requiredRoles={[UserRole.ADMIN, UserRole.OWNER, UserRole.MEMBER, UserRole.TRADER]}>
      <Suspense
        fallback={
          <div className="h-screen w-full bg-background flex items-center justify-center">
            <Loader2 className="animate-spin text-cyber-green" size={32} />
          </div>
        }
      >
        <ChatContent />
      </Suspense>
    </RoleGuard>
  );
}

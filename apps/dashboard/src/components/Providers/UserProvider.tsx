'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { UserIdentity } from '@claw/core/lib/session/identity/types';

interface UserContextType {
  user: Omit<UserIdentity, 'hashedPassword'> | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Provider for managing the current authenticated user's profile and permissions.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Omit<UserIdentity, 'hashedPassword'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[UserProvider] Failed to fetch user:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser();
  }, [fetchUser]);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        refreshUser: fetchUser,
        isAdmin,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

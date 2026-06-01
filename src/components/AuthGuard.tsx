'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: ('OWNER' | 'ADMIN' | 'KASIR')[];
  requireStore?: boolean;
}

export default function AuthGuard({ children, requiredRole, requireStore = true }: AuthGuardProps) {
  const router = useRouter();
  const { user, isLoading, isInitialized, memberships, activeStore, activeRole, initialize } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (isLoading || !isInitialized) return;

    // Not logged in → go to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // No store membership → go to onboarding
    if (requireStore && memberships.length === 0) {
      router.replace('/onboarding');
      return;
    }

    // Has memberships but no active store selected → store picker or auto-select
    if (requireStore && !activeStore && memberships.length > 1) {
      router.replace('/store-picker');
      return;
    }

    // Check role if required
    if (requiredRole && activeRole && !requiredRole.includes(activeRole)) {
      router.replace('/cashier');
      return;
    }
  }, [user, isLoading, isInitialized, memberships, activeStore, activeRole, requireStore, requiredRole, router]);

  if (isLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-slate font-sans">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (requireStore && memberships.length === 0) return null;
  if (requireStore && !activeStore && memberships.length > 1) return null;
  if (requiredRole && activeRole && !requiredRole.includes(activeRole)) return null;

  return <>{children}</>;
}

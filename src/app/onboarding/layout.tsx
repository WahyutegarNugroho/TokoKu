'use client';

import AuthGuard from '@/components/AuthGuard';
import AuthNav from '@/components/AuthNav';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireStore={false}>
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <AuthNav />
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}

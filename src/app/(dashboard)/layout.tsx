'use client';

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <AuthGuard requireStore={true}>
      <div className="h-full flex overflow-hidden">
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-overlay-dark z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Sidebar: always visible on md+, slide-in on mobile */}
        <div className={`fixed inset-y-0 left-0 z-50 w-[240px] transform transition-transform duration-200 md:static md:transform-none ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar onClose={() => setMobileSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

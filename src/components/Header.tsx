'use client';

import { useState } from 'react';
import { Wifi, WifiOff, CloudLightning, RefreshCw, Store, Moon, Sun, Menu } from 'lucide-react';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { useAuthStore } from '@/store/authStore';

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { isOnline, pendingCount, isSyncing, triggerSyncNow } = useSyncEngine();
  const { activeStore } = useAuthStore();

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
    try { localStorage.setItem('darkMode', String(next)); } catch {}
  };

  return (
    <header className="h-[64px] bg-surface border-b border-hairline flex items-center justify-between px-4 md:px-6 flex-shrink-0 gap-2">
      <div className="flex items-center space-x-3 min-w-0">
        <button aria-label="Buka menu navigasi" onClick={onMenuClick} className="p-2 text-slate hover:text-ink rounded-lg hover:bg-canvas transition-colors cursor-pointer md:hidden flex-shrink-0">
          <Menu className="w-5 h-5" />
        </button>
        <Store className="w-5 h-5 text-primary flex-shrink-0 hidden md:block" />
        <h1 className="font-sans font-semibold text-lg text-ink truncate">{activeStore?.name || 'Dashboard POS'}</h1>
      </div>

      {/* Network Status and Sync Info */}
      <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
        {/* Dark mode toggle */}
        <button onClick={toggleDark} className="p-2 text-slate hover:text-ink rounded-lg hover:bg-canvas transition-colors cursor-pointer" title={dark ? 'Mode Terang' : 'Mode Gelap'} aria-label={dark ? 'Mode Terang' : 'Mode Gelap'}>
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Network Status Badge */}
        {isOnline ? (
          <div className="inline-flex items-center bg-success-soft text-success font-sans font-semibold text-[11px] uppercase tracking-[0.5px] rounded-full px-[10px] py-[4px]">
            <Wifi className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden md:inline">Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center bg-warning-soft text-warning font-sans font-semibold text-[11px] uppercase tracking-[0.5px] rounded-full px-[10px] py-[4px]">
            <WifiOff className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden md:inline">Offline Mode</span>
          </div>
        )}

        {/* Sync Pending Badge (click to trigger manually) */}
        {pendingCount > 0 && (
          <button
            onClick={() => triggerSyncNow()}
            disabled={isSyncing || !isOnline}
            className="inline-flex items-center bg-primary-soft text-primary font-mono font-medium text-[12px] rounded-lg px-2.5 py-1.5 hover:bg-primary-soft/80 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            title="Klik untuk sinkronisasi manual sekarang"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <CloudLightning className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
            )}
            <span className="hidden md:inline">{pendingCount} Pending Sync</span>
          </button>
        )}
      </div>
    </header>
  );
}

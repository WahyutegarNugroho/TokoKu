'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/dexie';
import { triggerSync } from '@/lib/syncEngine';
import { useAuthStore } from '@/store/authStore';

export function useSyncEngine() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { activeStore } = useAuthStore();
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(10000);
  const lastSyncRef = useRef(0);
  const mountedRef = useRef(true);

  const updatePendingCount = useCallback(async () => {
    try {
      let count = await db.transactions
        .where('sync_status')
        .equals(0)
        .count();

      if (activeStore) {
        const unsynced = await db.transactions
          .where('sync_status')
          .equals(0)
          .toArray();
        count = unsynced.filter(tx => tx.store_id === activeStore.id).length;
      }

      setPendingCount(count);
      return count;
    } catch (err) {
      console.error('Failed to count pending transactions:', err);
      return 0;
    }
  }, [activeStore]);

  const triggerSyncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    const now = Date.now();
    if (now - lastSyncRef.current < 5000) return;
    lastSyncRef.current = now;

    setIsSyncing(true);
    try {
      await triggerSync(activeStore?.id);
      const count = await updatePendingCount();
      if (count === 0) {
        backoffRef.current = Math.min(backoffRef.current * 2, 120000);
      } else {
        backoffRef.current = 10000;
      }
    } catch (err) {
      console.error('Trigger sync error:', err);
      backoffRef.current = Math.min(backoffRef.current * 1.5, 60000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updatePendingCount, activeStore]);

  useEffect(() => {
    mountedRef.current = true;
    setTimeout(() => setIsOnline(navigator.onLine), 0);
    setTimeout(() => updatePendingCount(), 0);

    const handleOnline = () => {
      setIsOnline(true);
      backoffRef.current = 10000;
      triggerSyncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const scheduleNextPoll = () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        const count = await updatePendingCount();
        if (count > 0 && navigator.onLine) {
          await triggerSyncNow();
        }
        if (mountedRef.current) {
          scheduleNextPoll();
        }
      }, backoffRef.current);
    };

    scheduleNextPoll();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [triggerSyncNow, updatePendingCount]);

  return {
    pendingCount,
    isSyncing,
    isOnline,
    triggerSyncNow,
    updatePendingCount
  };
}

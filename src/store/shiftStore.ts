'use client';

import { create } from 'zustand';
import { db } from '@/lib/dexie';
import { dataService } from '@/lib/dataService';
import { broadcast } from '@/lib/broadcast';

/** Shift management state — local-first with Supabase fallback. */
interface ShiftState {
  /** ID of the currently active (open) shift, or null if no shift is open. */
  activeShiftId: string | null;
  /** Loading state during shift operations. */
  loading: boolean;

  /**
   * Initialize shift state — check Dexie for open shift, fallback to Supabase if online.
   * Called when cashier page mounts with user and store context.
   */
  initialize: (userId: string, storeId: string) => Promise<void>;
  /**
   * Open a new shift — saves to Dexie immediately, attempts Supabase sync if online.
   * @param beginningCash - Initial cash amount in the drawer at shift start
   * @returns The new shift ID
   */
  openShift: (userId: string, storeId: string, beginningCash?: number) => Promise<string>;
  /**
   * Close the active shift — updates Dexie immediately, attempts Supabase sync if online.
   * Does nothing if no shift is active.
   */
  closeShift: () => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  activeShiftId: null,
  loading: true,

  initialize: async (userId: string, storeId: string) => {
    set({ loading: true });
    try {
      const openShift = await db.shifts
        .where('status')
        .equals('OPEN')
        .filter((s) => s.user_id === userId && s.store_id === storeId)
        .first();

      if (openShift) {
        set({ activeShiftId: openShift.id });
      } else {
        if (navigator.onLine) {
          try {
            const data = await dataService.shifts.getOpenShift(userId, storeId);
            if (data) {
              await db.shifts.put({
                id: data.id,
                store_id: data.store_id,
                user_id: data.user_id,
                start_time: data.start_time,
                end_time: data.end_time || null,
                beginning_cash: data.beginning_cash || 0,
                status: data.status
              });
              set({ activeShiftId: data.id });
            }
          } catch (err) {
            console.warn('Gagal mengambil shift dari server, fallback ke shift lokal:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error initializing shift:', err);
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Open a new shift — saves to Dexie immediately, attempts Supabase sync if online.
   * @param beginningCash - Initial cash amount in the drawer at shift start
   * @returns The new shift ID
   */
  openShift: async (userId: string, storeId: string, beginningCash = 0) => {
    set({ loading: true });
    try {
      const shiftId = crypto.randomUUID();
      const newShift = {
        id: shiftId,
        store_id: storeId,
        user_id: userId,
        start_time: new Date().toISOString(),
        beginning_cash: beginningCash,
        status: 'OPEN' as const
      };

      await db.shifts.put(newShift);

      if (navigator.onLine) {
        await dataService.shifts.createShift(shiftId, storeId, userId, newShift.start_time, beginningCash);
      }

      set({ activeShiftId: shiftId });
      broadcast({ type: 'SHIFT_CHANGE', payload: { shiftId, action: 'OPEN', storeId } });
      return shiftId;
    } catch (err) {
      console.error('Error opening shift:', err);
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  closeShift: async () => {
    const shiftId = get().activeShiftId;
    if (!shiftId) return;

    set({ loading: true });
    try {
      const endTime = new Date().toISOString();

      const localShift = await db.shifts.get(shiftId);
      if (localShift) {
        localShift.status = 'CLOSED';
        localShift.end_time = endTime;
        await db.shifts.put(localShift);
      }

      if (navigator.onLine) {
        await dataService.shifts.closeShift(shiftId, endTime);
      }

      set({ activeShiftId: null });
      broadcast({ type: 'SHIFT_CHANGE', payload: { shiftId, action: 'CLOSE' } });
    } catch (err) {
      console.error('Error closing shift:', err);
    } finally {
      set({ loading: false });
    }
  }
}));

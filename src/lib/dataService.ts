import { supabase } from './supabase';
import { type MembershipRow } from '@/types';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
}

export interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  tax_enabled: boolean;
  tax_rate: number;
}

export interface StoreMembership {
  store: StoreInfo;
  role: 'OWNER' | 'ADMIN' | 'KASIR';
}

export const dataService = {
  users: {
    getProfile: async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('Failed to fetch profile:', error.message);
        return null;
      }
      return data as UserProfile | null;
    },
  },

  memberships: {
    getUserMemberships: async (): Promise<StoreMembership[]> => {
      const { data, error } = await supabase.rpc('get_user_memberships');
      if (error) {
        console.error('Failed to fetch memberships:', error.message);
        return [];
      }
      if (data?.error) {
        console.error('RPC error:', data.error);
        return [];
      }
      if (!data?.success) return [];

      const raw = data.memberships;
      const memberships = Array.isArray(raw) ? raw : [];
      return memberships.map((m: MembershipRow) => ({
        store: {
          id: m.store_id,
          name: m.store_name,
          address: m.store_address,
          phone: m.store_phone,
          logo_url: m.store_logo_url ?? null,
          tax_enabled: m.store_tax_enabled ?? false,
          tax_rate: m.store_tax_rate ?? 0,
        },
        role: m.role as 'OWNER' | 'ADMIN' | 'KASIR',
      }));
    },
  },

  shifts: {
    getOpenShift: async (userId: string, storeId: string) => {
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .eq('status', 'OPEN')
        .maybeSingle();
      return data;
    },

    createShift: async (shiftId: string, storeId: string, userId: string, startTime: string, beginningCash = 0) => {
      try {
        return await supabase.from('shifts').insert({
          id: shiftId,
          store_id: storeId,
          user_id: userId,
          start_time: startTime,
          beginning_cash: beginningCash,
          status: 'OPEN',
        });
      } catch (err) {
        console.warn('Failed to sync open shift to Supabase, will sync later.', err);
        return { error: err };
      }
    },

    closeShift: async (shiftId: string, endTime: string) => {
      try {
        return await supabase
          .from('shifts')
          .update({ status: 'CLOSED', end_time: endTime })
          .eq('id', shiftId);
      } catch (err) {
        console.warn('Failed to sync close shift to Supabase.', err);
        return { error: err };
      }
    },
  },
};

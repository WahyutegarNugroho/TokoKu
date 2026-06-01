'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dataService } from '@/lib/dataService';
import { useToastStore } from '@/store/toastStore';
import type { User } from '@supabase/supabase-js';

/** Extended user profile from public.users table. */
interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
}

/** Store information with tax configuration. */
interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  tax_enabled: boolean;
  tax_rate: number;
}

/** User's membership in a store with role. */
interface StoreMembership {
  store: StoreInfo;
  role: 'OWNER' | 'ADMIN' | 'KASIR';
}

/** Auth state managed by Zustand store. */
interface AuthState {
  /** Current Supabase user (null if not logged in). */
  user: User | null;
  /** User profile from public.users table. */
  profile: UserProfile | null;
  /** All stores the user is a member of. */
  memberships: StoreMembership[];
  /** Currently active store (selected by user). */
  activeStore: StoreInfo | null;
  /** User's role in the active store. */
  activeRole: 'OWNER' | 'ADMIN' | 'KASIR' | null;
  /** Loading state during initialization. */
  isLoading: boolean;
  /** Whether initialization has completed. */
  isInitialized: boolean;

  /** Initialize auth state from session + localStorage. Called on app mount. */
  initialize: () => Promise<void>;
  /** Fetch user profile from Supabase. */
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
  /** Fetch all store memberships via RPC. */
  fetchMemberships: () => Promise<StoreMembership[]>;
  /** Set active store and persist to localStorage. */
  setActiveStore: (storeId: string) => void;
  /** Sign in with email/password, then initialize auth state. */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign up with email/password, then auto sign-in. */
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  /** Sign out, clear localStorage, and reset state. */
  signOut: () => Promise<void>;
  /** Reset all auth state to initial values. */
  reset: () => void;
}

function cacheAuthState(user: { id: string; email?: string | null } | null, profile: unknown, memberships: unknown[], activeStoreId: string | null) {
  try {
    localStorage.setItem('tokoku-auth-cache', JSON.stringify({ user, profile, memberships, activeStoreId }));
  } catch { /* localStorage may be full or disabled */ }
}

function restoreAuthCache(): Partial<AuthState> | null {
  try {
    const raw = localStorage.getItem('tokoku-auth-cache');
    if (!raw) return null;
    const { user, profile, memberships, activeStoreId } = JSON.parse(raw);
    let activeStore: StoreInfo | null = null;
    let activeRole: 'OWNER' | 'ADMIN' | 'KASIR' | null = null;
    if (activeStoreId && Array.isArray(memberships)) {
      const m = (memberships as StoreMembership[]).find((mem: StoreMembership) => mem.store?.id === activeStoreId);
      if (m) {
        activeStore = m.store;
        activeRole = m.role;
      }
    }
    return { user, profile, memberships, activeStore, activeRole };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  memberships: [],
  activeStore: null,
  activeRole: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      let session = null;
      try {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      } catch (sessionErr) {
        console.warn('Unable to reach Supabase server for session:', sessionErr);
      }

      if (!session?.user) {
        const cached = restoreAuthCache();
        if (cached) {
          set({ ...cached, isLoading: false, isInitialized: true });
          useToastStore.getState().addToast('Server tidak dapat dijangkau. Menggunakan data offline.', 'info');
          return;
        }
        set({ user: null, profile: null, memberships: [], activeStore: null, activeRole: null, isLoading: false, isInitialized: true });
        return;
      }

      const user = session.user;
      let profile = null;
      let memberships: StoreMembership[] = [];

      try {
        const [profData, membData] = await Promise.all([
          get().fetchProfile(user.id),
          get().fetchMemberships(),
        ]);
        profile = profData;
        memberships = membData;
      } catch (fetchErr) {
        console.warn('Unable to load profile/memberships from server:', fetchErr);
      }

      let activeStore: StoreInfo | null = null;
      let activeRole: 'OWNER' | 'ADMIN' | 'KASIR' | null = null;

      const savedStoreId = typeof window !== 'undefined' ? localStorage.getItem('activeStoreId') : null;
      if (savedStoreId && memberships.length > 0) {
        const membership = memberships.find(m => m.store?.id === savedStoreId);
        if (membership) {
          activeStore = membership.store;
          activeRole = membership.role;
        }
      }

      if (!activeStore && memberships.length === 1) {
        activeStore = memberships[0].store;
        activeRole = memberships[0].role;
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeStoreId', activeStore.id);
        }
      }

      set({ user, profile, memberships, activeStore, activeRole, isLoading: false, isInitialized: true });
      cacheAuthState(user, profile, memberships, activeStore?.id || null);
    } catch (err) {
      console.error('Auth initialization error:', err);
      const cached = restoreAuthCache();
      if (cached) {
        set({ ...cached, isLoading: false, isInitialized: true });
        useToastStore.getState().addToast('Gagal memuat data dari server. Menggunakan data tersimpan.', 'info');
      } else {
        set({ isLoading: false, isInitialized: true });
        useToastStore.getState().addToast('Gagal terhubung ke server. Periksa koneksi Anda.', 'error');
      }
    }
  },

  fetchProfile: async (userId: string) => {
    return dataService.users.getProfile(userId);
  },

  fetchMemberships: async () => {
    return dataService.memberships.getUserMemberships();
  },

  setActiveStore: (storeId: string) => {
    const { memberships } = get();
    const membership = memberships.find(m => m.store?.id === storeId);
    if (membership) {
      set({ activeStore: membership.store, activeRole: membership.role });
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeStoreId', storeId);
      }
    }
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    await get().initialize();
    return { error: null };
  },

  signUp: async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    if (error) return { error: error.message };

    // Jika email confirmation aktif, session tidak dikembalikan
    if (!data.session) {
      return { error: 'Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi sebelum login.' };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return { error: signInError.message };

    await get().initialize();
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeStoreId');
      localStorage.removeItem('tokoku-auth-cache');
    }
    get().reset();
  },

  reset: () => {
    set({
      user: null,
      profile: null,
      memberships: [],
      activeStore: null,
      activeRole: null,
      isLoading: false,
      isInitialized: false,
    });
  },
}));

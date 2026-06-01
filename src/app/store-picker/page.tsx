'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';
import { Store, ChevronRight, Crown, Shield, User } from 'lucide-react';

const roleIcon = { OWNER: Crown, ADMIN: Shield, KASIR: User };
const roleLabel = { OWNER: 'Pemilik', ADMIN: 'Admin', KASIR: 'Kasir' };

function StorePickerContent() {
  const router = useRouter();
  const { memberships, setActiveStore } = useAuthStore();

  useEffect(() => {
    if (memberships.length === 0) { router.replace('/onboarding'); return; }
    if (memberships.length === 1) {
      setActiveStore(memberships[0].store.id);
      router.replace('/cashier');
    }
  }, [memberships, router, setActiveStore]);

  const handleSelect = (storeId: string) => {
    setActiveStore(storeId);
    router.replace('/cashier');
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <Store className="w-7 h-7 text-on-primary" />
            </div>
            <h1 className="font-sans font-bold text-2xl text-ink">Pilih Toko</h1>
            <p className="text-slate font-sans text-sm mt-1">Anda terdaftar di beberapa toko. Pilih salah satu untuk mulai.</p>
          </div>

          <div className="space-y-3">
            {memberships.map((m) => {
              const Icon = roleIcon[m.role];
              return (
                <button
                  key={m.store.id}
                  onClick={() => handleSelect(m.store.id)}
                  className="w-full flex items-center justify-between p-4 bg-canvas rounded-xl border border-hairline hover:border-primary/40 hover:bg-primary-soft/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 bg-primary-soft text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-sans font-bold text-ink group-hover:text-primary transition-colors">{m.store.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon className="w-3 h-3 text-slate" />
                        <span className="text-xs text-slate font-sans">{roleLabel[m.role]}</span>
                        {m.store.address && <span className="text-xs text-muted font-sans ml-1">• {m.store.address}</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-steel group-hover:text-primary transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StorePickerPage() {
  return (
    <AuthGuard requireStore={false}>
      <StorePickerContent />
    </AuthGuard>
  );
}

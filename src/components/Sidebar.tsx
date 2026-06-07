'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShoppingCart, LayoutDashboard, LogOut, Store, Crown, Shield, User, Settings, X, Loader2, Building2, Tag } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { storesApi } from '@/lib/api';

const roleIcon = { OWNER: Crown, ADMIN: Shield, KASIR: User };
const roleLabel = { OWNER: 'Pemilik', ADMIN: 'Admin', KASIR: 'Kasir' };

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, activeStore, activeRole, memberships, signOut } = useAuthStore();

  const canAccessAdmin = activeRole === 'OWNER' || activeRole === 'ADMIN';
  const isOwner = activeRole === 'OWNER';
  const RoleIcon = activeRole ? roleIcon[activeRole] : User;

  const [showEditStore, setShowEditStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(11);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditStore = () => {
    if (!activeStore) return;
    setStoreName(activeStore.name);
    setStoreAddress(activeStore.address || '');
    setStorePhone(activeStore.phone || '');
    setTaxEnabled(activeStore.tax_enabled);
    setTaxRate(activeStore.tax_rate);
    setEditError(null);
    setShowEditStore(true);
  };

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !activeStore) return;
    setSaving(true);
    setEditError(null);
    const prevStore = activeStore;
    const optimisticStore = { ...prevStore, name: storeName.trim(), address: storeAddress.trim() || null, phone: storePhone.trim() || null, tax_enabled: taxEnabled, tax_rate: taxRate };
    useAuthStore.setState({ activeStore: optimisticStore });
    setShowEditStore(false);
    try {
      const { error } = await storesApi.update(prevStore.id, {
        name: storeName.trim(), address: storeAddress.trim() || null, phone: storePhone.trim() || null,
        tax_enabled: taxEnabled, tax_rate: taxRate,
      });
      if (error) throw error;
    } catch (err) {
      useAuthStore.setState({ activeStore: prevStore });
      setEditError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
    finally { setSaving(false); }
  };

  const menuItems = [
    { name: 'Kasir', href: '/cashier', icon: ShoppingCart, visible: true },
    { name: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard, visible: canAccessAdmin },
    { name: 'Kategori', href: '/categories', icon: Tag, visible: canAccessAdmin },
    { name: 'Manajemen Toko', href: '/stores', icon: Building2, visible: isOwner },
  ].filter(item => item.visible);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <>
    <aside className="w-[240px] bg-secondary text-on-dark flex flex-col h-full flex-shrink-0 border-r border-hairline/10">
      <div className="h-[64px] flex items-center px-5 border-b border-hairline/10 gap-3">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          {activeStore?.logo_url
            ? <Image src={activeStore.logo_url} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover" />
            : <Store className="w-5 h-5 text-on-primary" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans font-bold text-sm text-on-dark truncate">{activeStore?.name || 'TokoKu'}</p>
          {activeRole && (
            <p className="font-sans text-[10px] text-stone uppercase tracking-wider">{roleLabel[activeRole]}</p>
          )}
        </div>
        {isOwner && (
          <button onClick={openEditStore} className="p-1.5 text-stone hover:text-on-dark hover:bg-secondary-pressed rounded-lg transition-colors cursor-pointer flex-shrink-0" title="Edit Toko" aria-label="Edit Toko">
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/cashier' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors font-sans text-[15px] font-semibold h-[48px] ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-stone hover:bg-secondary-pressed hover:text-on-dark'
              }`}
            >
              <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {!isOwner && memberships.length > 1 && (
        <div className="px-4 pb-2">
          <Link
            href="/store-picker"
            className="flex items-center px-4 py-2.5 rounded-lg text-stone hover:bg-secondary-pressed hover:text-on-dark transition-colors font-sans text-[13px] font-medium"
          >
            <Store className="w-4 h-4 mr-2" />
            Ganti Toko
          </Link>
        </div>
      )}

      <div className="p-4 border-t border-hairline/10 bg-secondary-pressed">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary-soft mr-3 flex-shrink-0">
              <RoleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-sans font-semibold text-[13px] truncate">{profile?.full_name || 'User'}</p>
              <p className="font-sans text-[11px] text-muted truncate">{profile?.email}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="p-2 text-stone hover:text-danger transition-colors cursor-pointer flex-shrink-0" title="Keluar" aria-label="Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    {showEditStore && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={() => setShowEditStore(false)}>
        <div className="bg-surface rounded-xl shadow-floating border border-hairline w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-sans font-bold text-[20px] text-ink">Edit Toko</h3>
            <button aria-label="Tutup modal edit toko" onClick={() => setShowEditStore(false)} className="p-1 text-slate hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={saveStore} className="space-y-4">
            {editError && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm border border-danger/20 font-sans">{editError}</div>}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Nama Toko *</label>
              <input type="text" required value={storeName} onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Alamat</label>
              <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Telepon</label>
              <input type="tel" value={storePhone} onChange={(e) => setStorePhone(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-charcoal">Aktifkan PPN</span>
              <button type="button" onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${taxEnabled ? 'bg-primary' : 'bg-stone'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white dark:bg-slate-200 rounded-full shadow transition-transform ${taxEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {taxEnabled && (
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Tarif PPN (%)</label>
                <input type="number" min="0" max="100" step="1" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" />
              </div>
            )}
            <button type="submit" disabled={saving}
              className="w-full bg-primary text-on-primary font-semibold text-[15px] h-[48px] rounded-lg hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan'}
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}

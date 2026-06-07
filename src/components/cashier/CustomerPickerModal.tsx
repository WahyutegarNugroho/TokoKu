'use client';

import React, { useEffect, useState } from 'react';
import { type LocalCustomer } from '@/lib/dexie';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDebounce } from '@/hooks/useDebounce';
import { customersApi } from '@/lib/api';

interface CustomerPoints {
  points: number;
  tier: string;
}

interface CustomerPickerModalProps {
  show: boolean;
  customers: LocalCustomer[];
  search: string;
  memberships?: Record<string, CustomerPoints>;
  onClose: () => void;
  onSearchChange: (search: string) => void;
  onSelect: (customer: LocalCustomer) => void;
  storeId?: string;
  onCustomerAdded?: () => void;
}

const tierBadge: Record<string, { bg: string; text: string }> = {
  BRONZE: { bg: 'bg-amber-100', text: 'text-amber-800' },
  SILVER: { bg: 'bg-slate-200', text: 'text-slate-700' },
  GOLD: { bg: 'bg-yellow-300', text: 'text-yellow-900' },
};

export default function CustomerPickerModal({
  show, customers, search, memberships, onClose, onSearchChange, onSelect, storeId, onCustomerAdded
}: CustomerPickerModalProps) {
  const focusRef = useFocusTrap(show);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('0');
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) {
      setTimeout(() => {
        setShowAddForm(false);
        setFormError(null);
      }, 0);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, onClose]);

  const debouncedSearch = useDebounce(search, 300);

  if (!show) return null;

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || c.phone.includes(debouncedSearch)
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    if (!newName.trim()) {
      setFormError('Nama wajib diisi.');
      return;
    }
    setIsAdding(true);
    setFormError(null);
    try {
      const creditLimitVal = parseFloat(newCreditLimit) || 0;
      const { data, error } = await customersApi.create(storeId, {
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        credit_limit: creditLimitVal,
      });
      if (error) throw error;
      if (data) {
        onCustomerAdded?.();
        onSelect(data);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setNewCreditLimit('0');
        setShowAddForm(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menambahkan pelanggan.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div ref={focusRef} className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-sm w-full overflow-hidden shadow-floating" onClick={e => e.stopPropagation()}>
        {showAddForm ? (
          <>
            <div className="p-4 border-b border-hairline flex justify-between items-center">
              <h3 className="font-sans font-bold text-[16px] text-ink">Tambah Pelanggan Baru</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-muted hover:text-ink text-sm font-semibold cursor-pointer">Batal</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-4 space-y-3 font-sans">
              {formError && <p className="text-xs text-danger bg-danger-soft p-2 rounded font-semibold">{formError}</p>}
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Nama Lengkap *</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary" placeholder="Nama Pelanggan" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">No. Telepon</label>
                <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary" placeholder="Contoh: 0812..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary" placeholder="nama@email.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Batas Piutang (Credit Limit)</label>
                <input type="number" value={newCreditLimit} onChange={e => setNewCreditLimit(e.target.value)} className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary font-mono" placeholder="0" />
              </div>
              <button type="submit" disabled={isAdding} className="w-full bg-success text-white font-semibold text-sm h-[44px] rounded-lg hover:bg-success/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50">
                {isAdding ? 'Menyimpan...' : 'Simpan & Pilih'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-hairline flex justify-between items-center">
              <h3 className="font-sans font-bold text-[16px] text-ink">Pilih Pelanggan</h3>
              <button type="button" onClick={onClose} className="text-muted hover:text-ink text-sm font-semibold cursor-pointer">Tutup</button>
            </div>
            <div className="p-4 flex gap-2">
              <input type="text" value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Cari nama/telepon..." className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[48px] text-sm focus:outline-none focus:border-primary" />
              {storeId && (
                <button type="button" onClick={() => setShowAddForm(true)} className="px-3 bg-success-soft text-success border border-success/20 rounded-lg text-sm font-semibold hover:bg-success-soft/80 cursor-pointer flex items-center gap-1 shrink-0">
                  Baru (+)
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-1">
              {filtered.map(c => {
                const m = memberships?.[c.id];
                const badge = m ? tierBadge[m.tier] : null;
                return (
                  <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left p-3 rounded-lg hover:bg-surface-muted text-sm text-ink font-sans cursor-pointer border border-hairline flex items-center justify-between">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <span className="font-semibold">{c.name}</span>
                        {c.phone && <span className="text-muted ml-2">{c.phone}</span>}
                      </div>
                      {m && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate font-mono">{m.points} pts</span>
                          {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{m.tier}</span>}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-slate text-center py-4">Pelanggan tidak ditemukan</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

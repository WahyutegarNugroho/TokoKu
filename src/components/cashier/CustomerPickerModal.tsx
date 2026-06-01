'use client';

import React, { useEffect } from 'react';

import { type LocalCustomer } from '@/lib/dexie';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDebounce } from '@/hooks/useDebounce';

interface CustomerPickerModalProps {
  show: boolean;
  customers: LocalCustomer[];
  search: string;
  onClose: () => void;
  onSearchChange: (search: string) => void;
  onSelect: (customer: LocalCustomer) => void;
}

export default function CustomerPickerModal({ show, customers, search, onClose, onSearchChange, onSelect }: CustomerPickerModalProps) {
  const focusRef = useFocusTrap(show);

  useEffect(() => {
    if (!show) return;
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

  return (
    <div ref={focusRef} className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-sm w-full overflow-hidden shadow-floating" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-hairline flex justify-between items-center">
          <h3 className="font-sans font-bold text-[16px] text-ink">Pilih Pelanggan</h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm font-semibold cursor-pointer">Tutup</button>
        </div>
        <div className="p-4">
          <input type="text" value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Cari nama/telepon..." className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[48px] text-sm focus:outline-none focus:border-primary" />
        </div>
        <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-1">
          {filtered.map(c => (
            <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left p-3 rounded-lg hover:bg-surface-muted text-sm text-ink font-sans cursor-pointer border border-hairline">
              <span className="font-semibold">{c.name}</span>
              {c.phone && <span className="text-muted ml-2">{c.phone}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-slate text-center py-4">Pelanggan tidak ditemukan</p>
          )}
        </div>
      </div>
    </div>
  );
}

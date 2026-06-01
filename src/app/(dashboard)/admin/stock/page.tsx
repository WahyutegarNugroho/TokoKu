'use client';

import React from 'react';
import StockHistoryView from '@/components/StockHistoryView';
import { useAuthStore } from '@/store/authStore';

export default function StockPage() {
  const { activeStore } = useAuthStore();

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted">
        <h3 className="font-sans font-bold text-[18px] text-ink">Riwayat Stok</h3>
      </div>
      <StockHistoryView storeId={activeStore?.id} />
    </div>
  );
}

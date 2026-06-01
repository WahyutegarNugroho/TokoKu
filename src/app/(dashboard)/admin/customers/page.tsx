'use client';

import React from 'react';
import CustomerManager from '@/components/CustomerManager';
import { useAuthStore } from '@/store/authStore';

export default function CustomersPage() {
  const { activeStore } = useAuthStore();

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between">
        <h3 className="font-sans font-bold text-[18px] text-ink">Daftar Pelanggan</h3>
      </div>
      <CustomerManager storeId={activeStore?.id} />
    </div>
  );
}

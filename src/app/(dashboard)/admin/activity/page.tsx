'use client';

import React from 'react';
import ActivityLogView from '@/components/ActivityLogView';
import { useAuthStore } from '@/store/authStore';

export default function ActivityPage() {
  const { activeStore } = useAuthStore();

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted">
        <h3 className="font-sans font-bold text-[18px] text-ink">Log Aktivitas</h3>
      </div>
      <ActivityLogView storeId={activeStore?.id} />
    </div>
  );
}

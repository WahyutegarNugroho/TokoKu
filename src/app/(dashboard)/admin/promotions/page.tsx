'use client';

import { useAuthStore } from '@/store/authStore';
import PromoManager from '@/components/PromoManager';

export default function PromotionsPage() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;

  if (!storeId) {
    return <div className="text-slate text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans font-bold text-2xl text-ink">Kelola Promo</h2>
        <p className="text-sm text-slate mt-1">Buat dan kelola promosi terjadwal dengan diskon persentase atau jumlah tetap.</p>
      </div>
      <PromoManager storeId={storeId} />
    </div>
  );
}

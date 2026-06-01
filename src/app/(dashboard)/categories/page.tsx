'use client';

import { useAuthStore } from '@/store/authStore';
import CategoryManager from '@/components/CategoryManager';

export default function CategoriesPage() {
  const { activeStore } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans font-bold text-2xl text-ink">Kelola Kategori</h1>
        <p className="text-slate font-sans text-sm mt-1">Tambah, edit, dan hapus kategori produk</p>
      </div>
      <CategoryManager storeId={activeStore?.id} />
    </div>
  );
}

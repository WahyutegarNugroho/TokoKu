'use client';

import React, { useState, useEffect, useCallback, startTransition } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/dexie';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { categoriesApi, productsApi, activityApi, stockHistoryApi } from '@/lib/api';
import ConfirmModal from '@/components/ConfirmModal';
import { SkeletonTable } from '@/components/Skeleton';
import RupiahInput from '@/components/RupiahInput';
import { type Product, type Category } from '@/types';
import { exportCSV } from '@/lib/utils';
import { Edit2, Trash2 } from 'lucide-react';

export default function ProductsPage() {
  const { user, activeStore } = useAuthStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [prodPage, setProdPage] = useState(0);
  const PROD_PAGE_SIZE = 20;

  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const logActivity = async (action: string, description: string) => {
    if (!activeStore?.id || !user?.id) return;
    try {
      await activityApi.log(activeStore.id, user.id, action, description);
    } catch (err) { console.warn('Activity log gagal:', err); }
  };

  const logStockHistory = async (productId: string, oldStock: number, newStock: number, reason: string) => {
    if (!activeStore?.id || !user?.id) return;
    try {
      await stockHistoryApi.log(activeStore.id, user.id, productId, oldStock, newStock, reason);
    } catch (err) { console.warn('Stock history log gagal:', err); }
  };

  const fetchData = useCallback(async () => {
    if (!activeStore) return;
    setDataLoading(true);
    try {
      // Read from Dexie first (offline-first)
      const localCats = await db.categories.where('store_id').equals(activeStore.id).toArray();
      if (localCats.length > 0) {
        setCategories(localCats.map(c => ({ id: c.id, store_id: activeStore.id, name: c.name, description: c.description })));
      }
      const localProds = await db.products.where('store_id').equals(activeStore.id).toArray();
      if (localProds.length > 0) {
        setProducts(localProds.map(p => ({ id: p.id, store_id: p.store_id, name: p.name, sku: p.sku, price: p.price, category_id: p.category_id, stock: p.stock, image_url: p.image_url })));
      }
      setProdPage(0);

      // Refresh from Supabase if online
      if (navigator.onLine) {
        const { data: catData } = await categoriesApi.list(activeStore.id);
        if (catData) {
          setCategories(catData);
          await db.transaction('rw', db.categories, async () => {
            for (const cat of catData) {
              await db.categories.put({ id: cat.id, store_id: cat.store_id, name: cat.name, description: cat.description || undefined });
            }
          });
        }
        const { data: prodData } = await productsApi.list(activeStore.id);
        if (prodData) {
          setProducts(prodData);
          await db.transaction('rw', db.products, async () => {
            for (const prod of prodData) {
              await db.products.put({ id: prod.id, store_id: prod.store_id, name: prod.name, sku: prod.sku, price: Number(prod.price), category_id: prod.category_id, stock: Number(prod.stock), image_url: prod.image_url });
            }
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data.';
      useToastStore.getState().addToast(message, 'error');
    } finally {
      setDataLoading(false);
    }
  }, [activeStore]);

  useEffect(() => {
    if (activeStore) {
      startTransition(() => {
        fetchData();
      });
    }
  }, [activeStore, fetchData]);

  const uploadProductImage = async (file: File): Promise<string | null> => {
    setImageUploading(true);
    try {
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (file.size > MAX_FILE_SIZE) {
        useToastStore.getState().addToast('File terlalu besar. Maksimal 2MB.', 'error');
        return null;
      }
      if (!allowedTypes.includes(file.type)) {
        useToastStore.getState().addToast('Format file tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
        return null;
      }
      const ext = file.name.split('.').pop();
      const fileName = crypto.randomUUID() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      useToastStore.getState().addToast('Upload gagal: ' + (err instanceof Error ? err.message : 'Error'), 'error');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const generateSku = () => {
    let newSku = '';
    let exists = true;
    while (exists) {
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      newSku = 'TKP' + randomDigits;
      exists = products.some((p) => p.sku === newSku);
    }
    setProdSku(newSku);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = prodName.trim();
    const trimmedSku = prodSku.trim();

    if (!trimmedName || !trimmedSku || !prodPrice.trim() || !activeStore) return;

    if (/\s/.test(trimmedSku)) {
      useToastStore.getState().addToast('SKU tidak boleh mengandung spasi.', 'error');
      return;
    }

    const price = parseFloat(prodPrice);
    if (isNaN(price) || price < 1) {
      useToastStore.getState().addToast('Harga minimal Rp 1.', 'error');
      return;
    }
    if (price > 999999999999) {
      useToastStore.getState().addToast('Harga melebihi batas maksimum.', 'error');
      return;
    }

    const rawStock = parseFloat(prodStock);
    if (isNaN(rawStock) || rawStock < 0 || !Number.isInteger(rawStock)) {
      useToastStore.getState().addToast('Stok harus berupa angka bulat positif.', 'error');
      return;
    }
    const stock = parseInt(prodStock, 10);

    let finalImageUrl = prodImageUrl || null;
    if (prodImageFile) {
      const uploaded = await uploadProductImage(prodImageFile);
      if (uploaded) finalImageUrl = uploaded;
    }

    const basePayload = {
      name: prodName.trim(),
      sku: prodSku.trim(),
      price,
      category_id: prodCategoryId || null,
      stock,
      image_url: finalImageUrl,
    };

    try {
      if (editingProdId) {
        const oldProduct = products.find((p) => p.id === editingProdId);
        const { error } = await productsApi.update(activeStore.id, editingProdId, basePayload);
        if (error) throw error;
        logActivity('UPDATE_PRODUCT', 'Produk ' + basePayload.name + ' diperbarui');
        if (oldProduct && oldProduct.stock !== basePayload.stock) {
          logStockHistory(editingProdId, oldProduct.stock, basePayload.stock, 'Penyesuaian stok');
        }
        useToastStore.getState().addToast('Produk diperbarui.', 'success');
      } else {
        const { data: newProd, error } = await productsApi.create(activeStore.id, basePayload);
        if (error) throw error;
        logActivity('CREATE_PRODUCT', 'Produk ' + basePayload.name + ' ditambahkan');
        if (basePayload.stock > 0) {
          logStockHistory(newProd!.id, 0, basePayload.stock, 'Stok awal');
        }
        useToastStore.getState().addToast('Produk ditambahkan.', 'success');
      }
      setProdName('');
      setProdSku('');
      setProdPrice('');
      setProdCategoryId('');
      setProdStock('');
      setProdImageUrl('');
      setProdImageFile(null);
      setProdImagePreview(null);
      setEditingProdId(null);
      fetchData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    }
  };

  const deleteProduct = (id: string) => {
    if (!activeStore) return;
    setConfirm({
      title: 'Hapus Produk',
      message: 'Yakin ingin menghapus produk ini?',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const prod = products.find((p) => p.id === id);
          const { error } = await productsApi.remove(activeStore.id, id);
          if (error) throw error;
          logActivity('DELETE_PRODUCT', 'Produk ' + (prod?.name || '') + ' dihapus');
          useToastStore.getState().addToast('Produk dihapus.', 'success');
          fetchData();
        } catch (err) {
          useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
        }
      },
    });
  };


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="bg-surface p-6 rounded-xl border border-hairline h-fit">
          <h3 className="font-sans font-bold text-[18px] text-ink mb-4">
            {editingProdId ? 'Edit Produk' : 'Tambah Produk'}
          </h3>
          <form onSubmit={saveProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Nama Produk</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-charcoal">SKU</label>
                  <button
                    type="button"
                    onClick={generateSku}
                    className="text-xs text-primary font-bold hover:underline cursor-pointer"
                  >
                    Gen
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Kategori</label>
                <select
                  value={prodCategoryId}
                  onChange={(e) => setProdCategoryId(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-3 h-[48px] text-[14px] focus:outline-none focus:border-primary font-sans"
                >
                  <option value="">Pilih...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Harga (Rp)</label>
                <RupiahInput
                  required
                  value={prodPrice}
                  onChange={(v) => setProdPrice(v)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Stok</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Gambar</label>
              {(prodImagePreview || prodImageUrl) && (
                <div className="relative mb-2 w-full h-28 rounded-lg overflow-hidden border border-hairline bg-canvas">
                  <Image
                    src={prodImagePreview || prodImageUrl}
                    alt="Preview"
                    width={400}
                    height={200}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setProdImageFile(null);
                      setProdImagePreview(null);
                      setProdImageUrl('');
                    }}
                    className="absolute top-1 right-1 bg-danger text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    x
                  </button>
                </div>
              )}
              <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-hairline rounded-lg h-[48px] cursor-pointer hover:border-primary hover:bg-primary-soft/30 transition-colors text-sm text-slate font-sans">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProdImageFile(file);
                      setProdImagePreview(URL.createObjectURL(file));
                      setProdImageUrl('');
                    }
                  }}
                />
                {imageUploading ? 'Mengupload...' : 'Pilih File Gambar'}
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={imageUploading}
                className="flex-1 bg-primary text-on-primary font-semibold text-[14px] h-[48px] rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer disabled:opacity-60"
              >
                {imageUploading ? 'Upload...' : editingProdId ? 'Simpan' : 'Tambah'}
              </button>
              {editingProdId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProdId(null);
                    setProdName('');
                    setProdSku('');
                    setProdPrice('');
                    setProdCategoryId('');
                    setProdStock('');
                    setProdImageUrl('');
                    setProdImageFile(null);
                    setProdImagePreview(null);
                  }}
                  className="px-4 border border-hairline text-charcoal font-semibold rounded-lg hover:bg-canvas cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Panel */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-hairline overflow-hidden">
          <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between">
            <h3 className="font-sans font-bold text-[18px] text-ink">Daftar Produk</h3>
            <button
              onClick={() =>
                exportCSV(
                  products.map((p) => ({
                    SKU: p.sku,
                    Nama: p.name,
                    Harga: p.price,
                    Stok: p.stock,
                    Kategori: categories.find((c) => c.id === p.category_id)?.name || '',
                  })),
                  'produk'
                )
              }
              className="text-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              Export CSV
            </button>
          </div>
          {dataLoading ? (
            <div className="p-6">
              <SkeletonTable rows={5} />
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-slate font-sans">Belum ada produk.</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate bg-surface-muted font-sans font-semibold">
                      <th className="p-4">SKU</th>
                      <th className="p-4">Nama</th>
                      <th className="p-4">Kategori</th>
                      <th className="p-4 text-right">Harga</th>
                      <th className="p-4 text-center">Stok</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {products
                      .slice(prodPage * PROD_PAGE_SIZE, (prodPage + 1) * PROD_PAGE_SIZE)
                      .map((prod) => {
                        const cat = categories.find((c) => c.id === prod.category_id);
                        return (
                          <tr key={prod.id} className="hover:bg-surface-muted">
                            <td className="p-4 font-mono text-[13px] text-charcoal">{prod.sku}</td>
                            <td className="p-4 font-sans font-bold text-ink">{prod.name}</td>
                            <td className="p-4 font-sans text-sm text-slate">{cat ? cat.name : '-'}</td>
                            <td className="p-4 font-mono text-right text-ink">
                              Rp {prod.price.toLocaleString('id-ID')}
                            </td>
                            <td className="p-4 font-mono text-center text-charcoal">{prod.stock}</td>
                            <td className="p-4 flex justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingProdId(prod.id);
                                  setProdName(prod.name);
                                  setProdSku(prod.sku);
                                  setProdPrice(prod.price.toString());
                                  setProdCategoryId(prod.category_id || '');
                                  setProdStock(prod.stock.toString());
                                  setProdImageUrl(prod.image_url || '');
                                  setProdImageFile(null);
                                  setProdImagePreview(null);
                                }}
                                aria-label="Edit produk"
                                className="p-2 text-primary hover:bg-primary-soft rounded-lg cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                aria-label="Hapus produk"
                                onClick={() => deleteProduct(prod.id)}
                                className="p-2 text-danger hover:bg-danger-soft rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {products.length > PROD_PAGE_SIZE && (
                <div className="flex items-center justify-between p-4 border-t border-hairline bg-surface-muted">
                  <span className="font-sans text-xs text-slate">{products.length} total produk</span>
                  <div className="flex gap-2">
                    <button
                      disabled={prodPage === 0}
                      onClick={() => setProdPage((p) => p - 1)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-hairline text-charcoal hover:bg-canvas disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1.5 text-xs font-mono text-slate">
                      {prodPage + 1}/{Math.ceil(products.length / PROD_PAGE_SIZE)}
                    </span>
                    <button
                      disabled={(prodPage + 1) * PROD_PAGE_SIZE >= products.length}
                      onClick={() => setProdPage((p) => p + 1)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-hairline text-charcoal hover:bg-canvas disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          open={!!confirm}
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { warehousesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, Plus, Building2, ArrowLeftRight, Package, MapPin } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  address?: string;
}

interface WarehouseStock {
  id: string;
  warehouse_id: string;
  product_id: string;
  stock: number;
  warehouse_name?: string;
  product_name?: string;
  sku?: string;
}

export default function WarehouseTab() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<WarehouseStock[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states (Create Warehouse)
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');

  // Form states (Transfer Stock)
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('0');

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Load products
      const localProds = await db.products.where('store_id').equals(storeId).toArray();
      setProducts(localProds.map(p => ({ id: p.id, name: p.name, sku: p.sku })));

      // Load warehouses from Dexie first
      const localWhs = await db.warehouses.where('store_id').equals(storeId).toArray();
      setWarehouses(localWhs);

      // Load warehouse stocks
      const localStocks = await db.warehouseStocks.where('store_id').equals(storeId).toArray();
      const mappedStocks = localStocks.map(s => {
        const wh = localWhs.find(w => w.id === s.warehouse_id);
        const p = localProds.find(pr => pr.id === s.product_id);
        return {
          id: s.id,
          warehouse_id: s.warehouse_id,
          product_id: s.product_id,
          stock: s.stock,
          warehouse_name: wh?.name || '(Gudang Dihapus)',
          product_name: p?.name || '(Produk Dihapus)',
          sku: p?.sku || '-'
        };
      });
      setStocks(mappedStocks);

      // Load from Supabase if online
      if (navigator.onLine) {
        const { data: whData } = await warehousesApi.list(storeId);
        if (whData) {
          await db.transaction('rw', db.warehouses, async () => {
            await db.warehouses.bulkPut(whData);
            const newIds = new Set(whData.map(w => w.id));
            const existing = await db.warehouses.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(w => !newIds.has(w.id)).map(w => w.id);
            if (toDelete.length > 0) await db.warehouses.bulkDelete(toDelete);
          });
          setWarehouses(whData);
        }

        const { data: stockData } = await warehousesApi.listStocks(storeId);
        if (stockData) {
          await db.transaction('rw', db.warehouseStocks, async () => {
            await db.warehouseStocks.bulkPut(stockData);
            const newIds = new Set(stockData.map(s => s.id));
            const existing = await db.warehouseStocks.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(s => !newIds.has(s.id)).map(s => s.id);
            if (toDelete.length > 0) await db.warehouseStocks.bulkDelete(toDelete);
          });

          setStocks(stockData.map(s => {
            const wh = (whData || localWhs).find(w => w.id === s.warehouse_id);
            const p = localProds.find(pr => pr.id === s.product_id);
            return {
              id: s.id,
              warehouse_id: s.warehouse_id,
              product_id: s.product_id,
              stock: s.stock,
              warehouse_name: wh?.name || '(Gudang Dihapus)',
              product_name: p?.name || '(Produk Dihapus)',
              sku: p?.sku || '-'
            };
          }));
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memuat gudang.', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [storeId, fetchData]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !whName.trim()) return;

    setSubmitting(true);
    try {
      await warehousesApi.create(storeId, {
        name: whName.trim(),
        address: whAddress.trim() || undefined
      });
      addToast('Gudang berhasil ditambahkan.', 'success');
      setWhName('');
      setWhAddress('');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !transferFrom || !transferTo || !transferProductId) {
      addToast('Harap lengkapi formulir transfer.', 'error');
      return;
    }
    if (transferFrom === transferTo) {
      addToast('Gudang asal dan tujuan tidak boleh sama.', 'error');
      return;
    }
    const qty = parseInt(transferQty) || 0;
    if (qty <= 0) {
      addToast('Jumlah transfer harus lebih dari 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Find source stock
      const sourceStock = stocks.find(s => s.warehouse_id === transferFrom && s.product_id === transferProductId);
      if (!sourceStock || sourceStock.stock < qty) {
        addToast('Stok gudang asal tidak mencukupi.', 'error');
        setSubmitting(false);
        return;
      }

      // Deduct source
      const newSourceStock = sourceStock.stock - qty;
      await warehousesApi.updateStock(storeId, transferFrom, transferProductId, newSourceStock);

      // Add target
      const targetStock = stocks.find(s => s.warehouse_id === transferTo && s.product_id === transferProductId);
      const newTargetStock = (targetStock?.stock || 0) + qty;
      await warehousesApi.updateStock(storeId, transferTo, transferProductId, newTargetStock);

      addToast('Transfer stok berhasil dicatat.', 'success');
      setTransferQty('0');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Transfer gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-hairline p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
        <p className="text-sm text-slate">Memuat data gudang...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Warehouse Form */}
        <div className="bg-surface p-6 rounded-xl border border-hairline h-fit space-y-4">
          <h3 className="font-sans font-bold text-[16px] text-ink flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Tambah Gudang Baru
          </h3>
          <form onSubmit={handleCreateWarehouse} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Nama Gudang *</label>
              <input
                type="text"
                required
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Alamat</label>
              <input
                type="text"
                value={whAddress}
                onChange={(e) => setWhAddress(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-semibold text-xs h-[40px] rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              {submitting && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" /> Simpan
            </button>
          </form>
        </div>

        {/* Transfer Stock Form */}
        <div className="bg-surface p-6 rounded-xl border border-hairline h-fit space-y-4">
          <h3 className="font-sans font-bold text-[16px] text-ink flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" /> Transfer Stok Antar Gudang
          </h3>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Dari Gudang</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  required
                  className="w-full bg-surface border border-hairline rounded-lg px-2 h-[40px] text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">Pilih...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Ke Gudang</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  required
                  className="w-full bg-surface border border-hairline rounded-lg px-2 h-[40px] text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">Pilih...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Produk</label>
              <select
                value={transferProductId}
                onChange={(e) => setTransferProductId(e.target.value)}
                required
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary"
              >
                <option value="">Pilih...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Jumlah</label>
              <input
                type="number"
                required
                min="1"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-semibold text-xs h-[40px] rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              {submitting && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
              Transfer Stok
            </button>
          </form>
        </div>

        {/* Warehouses Listing */}
        <div className="bg-surface p-6 rounded-xl border border-hairline h-fit space-y-4">
          <h3 className="font-sans font-bold text-[16px] text-ink flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Daftar Gudang
          </h3>
          <div className="divide-y divide-hairline">
            {warehouses.length === 0 ? (
              <p className="text-xs text-slate py-4">Belum ada gudang terdaftar.</p>
            ) : (
              warehouses.map(w => (
                <div key={w.id} className="py-2.5">
                  <p className="font-sans font-bold text-sm text-ink">{w.name}</p>
                  <p className="text-[11px] text-slate font-sans mt-0.5">{w.address || 'Tanpa alamat'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Warehouse Stocks Grid */}
      <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
        <div className="p-4 border-b border-hairline bg-surface-muted flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-sans font-bold text-sm text-ink">Stok per Gudang</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-hairline bg-surface-muted text-slate text-left font-semibold font-sans">
                <th className="p-3">Gudang</th>
                <th className="p-3">Nama Produk</th>
                <th className="p-3">SKU</th>
                <th className="p-3 text-center">Saldo Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {stocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate">Belum ada saldo stok di gudang.</td>
                </tr>
              ) : (
                stocks.map(s => (
                  <tr key={s.id} className="hover:bg-surface-muted">
                    <td className="p-3 font-semibold text-ink">{s.warehouse_name}</td>
                    <td className="p-3 font-semibold text-charcoal">{s.product_name}</td>
                    <td className="p-3 font-mono text-slate">{s.sku}</td>
                    <td className="p-3 text-center font-mono font-bold text-primary">{s.stock}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { suppliersApi, purchaseOrdersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, ClipboardList, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

interface POItem {
  product_id: string; product_name?: string; quantity: number; unit_price: number;
}

interface PurchaseOrder {
  id: string; supplier_id: string; supplier_name?: string;
  total_amount: number; status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  created_at: string; items?: POItem[];
}

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; }

export default function PurchaseOrdersPage() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formSupplier, setFormSupplier] = useState('');
  const [formItems, setFormItems] = useState<{ product_id: string; quantity: string; unit_price: string }[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Local data
      const local = await db.purchaseOrders.where('store_id').equals(storeId).toArray();
      local.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setOrders(local.map(o => ({ ...o, total_amount: Number(o.total_amount) })));

      // Online refresh
      if (navigator.onLine) {
        const { data } = await purchaseOrdersApi.list(storeId);
        if (data) {
          const mapped = data.map((o: Record<string, unknown>) => {
            const s = o.suppliers as { name?: string } | undefined;
            return {
              id: o.id as string,
              supplier_id: o.supplier_id as string,
              supplier_name: s?.name,
              total_amount: Number(o.total_amount),
              status: o.status as PurchaseOrder['status'],
              created_at: o.created_at as string,
            };
          });
          setOrders(mapped);
          await db.transaction('rw', db.purchaseOrders, async () => {
            for (const o of mapped) {
              await db.purchaseOrders.put({ id: o.id, store_id: storeId, supplier_id: o.supplier_id, total_amount: o.total_amount, status: o.status, created_at: o.created_at });
            }
            const newIds = new Set(mapped.map(o => o.id));
            const existing = await db.purchaseOrders.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(o => !newIds.has(o.id)).map(o => o.id);
            if (toDelete.length > 0) await db.purchaseOrders.bulkDelete(toDelete);
          });
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memuat PO.', 'error');
    } finally { setLoading(false); }
  }, [storeId, addToast]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [storeId, fetchData]);

  const openCreateForm = async () => {
    if (!storeId) return;
    try {
      const { data: sData } = await suppliersApi.list(storeId);
      setSuppliers((sData || []).map((s: Record<string, unknown>) => ({ id: s.id as string, name: s.name as string })));
      if (navigator.onLine) {
        const { data: pData } = await supabase.from('products').select('id, name').eq('store_id', storeId).order('name');
        setProducts((pData || []).map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string })));
      } else {
        const local = await db.products.where('store_id').equals(storeId).toArray();
        setProducts(local.map(p => ({ id: p.id, name: p.name })));
      }
      setFormSupplier(''); setFormItems([{ product_id: '', quantity: '1', unit_price: '0' }]); setShowForm(true);
    } catch {
      addToast('Gagal memuat data form.', 'error');
    }
  };

  const addFormItem = () => setFormItems(prev => [...prev, { product_id: '', quantity: '1', unit_price: '0' }]);
  const removeFormItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const updateFormItem = (idx: number, field: keyof typeof formItems[0], value: string) => {
    setFormItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const submitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !formSupplier) return;
    const items = formItems.filter(i => i.product_id && Number(i.quantity) > 0).map(i => ({
      product_id: i.product_id,
      quantity: Math.round(Number(i.quantity)),
      unit_price: Number(i.unit_price),
    }));
    if (items.length === 0) { addToast('Minimal satu item.', 'error'); return; }
    setSubmitting(true);
    try {
      await purchaseOrdersApi.create(storeId, { supplier_id: formSupplier, items });
      addToast('Purchase Order dibuat.', 'success');
      setShowForm(false); fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat PO.', 'error');
    } finally { setSubmitting(false); }
  };

  const receivePO = async (po: PurchaseOrder) => {
    if (!storeId) return;
    setSubmitting(true);
    try {
      const { data: full } = await purchaseOrdersApi.getById(storeId, po.id);
      if (!full) { addToast('Data PO tidak ditemukan.', 'error'); return; }
      const items = (full.purchase_order_items || []).map((i: Record<string, unknown>) => ({
        product_id: i.product_id as string, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
      }));
      // If no items yet (PO was created offline), use what's cached locally
      const result = await purchaseOrdersApi.receive(storeId, po.id, items.length > 0 ? items : (po.items || []).map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })));
      if (result.error) throw result.error;
      addToast('Pesanan diterima. Stok bertambah.', 'success');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menerima PO.', 'error');
    } finally { setSubmitting(false); }
  };

  const cancelPO = async (po: PurchaseOrder) => {
    if (!storeId || !po.items) return;
    try {
      await purchaseOrdersApi.cancel(storeId, po.id, po.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })));
      addToast('PO dibatalkan.', 'success');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal membatalkan PO.', 'error');
    }
  };

  const toggleExpand = async (poId: string) => {
    if (expandedId === poId) { setExpandedId(null); return; }
    setExpandedId(poId);

    if (navigator.onLine && storeId) {
      try {
        const { data } = await purchaseOrdersApi.getById(storeId, poId);
        if (data) {
          setOrders(prev => prev.map(o => {
            if (o.id === poId) {
              const items = (data.purchase_order_items || []).map((i: Record<string, unknown>) => {
                const prodName = products.find(p => p.id === i.product_id)?.name || (i.product as { name?: string })?.name || '(Produk)';
                return { product_id: i.product_id as string, product_name: prodName, quantity: Number(i.quantity), unit_price: Number(i.unit_price) };
              });
              return { ...o, items };
            }
            return o;
          }));
        }
      } catch {}
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-warning-soft text-warning',
      RECEIVED: 'bg-success-soft text-success',
      CANCELLED: 'bg-danger-soft text-danger',
    };
    const label: Record<string, string> = { PENDING: 'Menunggu', RECEIVED: 'Diterima', CANCELLED: 'Dibatalkan' };
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status] || 'bg-slate-soft text-slate'}`}>{label[status] || status}</span>;
  };

  if (loading && orders.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-hairline p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
        <p className="text-sm text-slate">Memuat Purchase Orders...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between">
        <h3 className="font-sans font-bold text-[18px] text-ink">Purchase Orders</h3>
        <button onClick={openCreateForm} className="bg-primary text-on-primary font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-primary-pressed cursor-pointer flex items-center gap-2"><Plus className="w-4 h-4" />Buat PO</button>
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-slate mb-3" />
          <p className="text-sm text-slate">Belum ada Purchase Order.</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {orders.map(po => (
            <div key={po.id}>
              <div className="p-4 flex items-center justify-between hover:bg-surface-muted cursor-pointer" onClick={() => toggleExpand(po.id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{po.supplier_name || '(Supplier)'}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate">
                    <span className="font-mono">Rp {Number(po.total_amount).toLocaleString('id-ID')}</span>
                    <span>{new Date(po.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {statusBadge(po.status)}
                  {po.status === 'PENDING' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); receivePO(po); }} disabled={submitting} className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Terima</button>
                      <button onClick={(e) => { e.stopPropagation(); cancelPO(po); }} disabled={submitting} className="px-3 py-1.5 bg-danger text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1"><XCircle className="w-3 h-3" />Batal</button>
                    </>
                  )}
                  {expandedId === po.id ? <ChevronUp className="w-4 h-4 text-slate" /> : <ChevronDown className="w-4 h-4 text-slate" />}
                </div>
              </div>
              {expandedId === po.id && po.items && (
                <div className="px-4 pb-4 pl-12 bg-canvas/50 space-y-1">
                  <p className="text-xs font-semibold text-slate uppercase tracking-wider mb-1">Item</p>
                  {po.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-charcoal">{item.product_name || '(Produk)'}</span>
                      <span className="text-xs text-slate font-mono">{item.quantity}x @ Rp {Number(item.unit_price).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create PO Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submitPO} className="bg-surface rounded-xl border border-hairline w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h4 className="font-sans font-bold text-lg text-ink">Buat Purchase Order</h4>

            <div>
              <label className="text-xs font-semibold text-slate block mb-1">Supplier</label>
              <select value={formSupplier} onChange={e => setFormSupplier(e.target.value)} required
                className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary">
                <option value="">Pilih supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate">Item</label>
                <button type="button" onClick={addFormItem} className="text-xs text-primary font-semibold hover:underline cursor-pointer">+ Tambah Item</button>
              </div>
              {formItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <select value={item.product_id} onChange={e => updateFormItem(idx, 'product_id', e.target.value)} required={idx === 0}
                    className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary">
                    <option value="">Pilih produk...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateFormItem(idx, 'quantity', e.target.value)} min={1} required
                    className="w-[70px] bg-canvas border border-hairline rounded-lg px-2 h-[40px] text-sm text-center focus:outline-none focus:border-primary" />
                  <input type="number" placeholder="Harga" value={item.unit_price} onChange={e => updateFormItem(idx, 'unit_price', e.target.value)} min={0} required
                    className="w-[100px] bg-canvas border border-hairline rounded-lg px-2 h-[40px] text-sm text-center font-mono focus:outline-none focus:border-primary" />
                  {formItems.length > 1 && (
                    <button type="button" onClick={() => removeFormItem(idx)} className="text-danger hover:bg-danger-soft p-2 rounded cursor-pointer">✕</button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={submitting}
                className="flex-1 h-[44px] border border-hairline rounded-lg text-sm font-semibold text-charcoal hover:bg-canvas cursor-pointer disabled:opacity-50">Batal</button>
              <button type="submit" disabled={submitting}
                className="flex-1 h-[44px] bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-pressed cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Buat PO
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

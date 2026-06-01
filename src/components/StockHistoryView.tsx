'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { storeId?: string; }

interface History { id: string; product_id: string; old_stock: number; new_stock: number; reason: string; product_name?: string; user_name?: string; created_at: string; }

export default function StockHistoryView({ storeId }: Props) {
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const fetchHistory = async (isRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      try {
        const { data } = await supabase
          .from('stock_history')
          .select('id, product_id, old_stock, new_stock, reason, user_id, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(100)
          .abortSignal(controller.signal);
        if (data) {
          const productIds = [...new Set(data.map(h => h.product_id))];
          const userIds = [...new Set(data.map(h => h.user_id))];
          const [{ data: products }, { data: users }] = await Promise.all([
            supabase.from('products').select('id, name').in('id', productIds).abortSignal(controller.signal),
            supabase.from('users').select('id, full_name').in('id', userIds).abortSignal(controller.signal),
          ]);
          const prodMap = new Map((products || []).map(p => [p.id, p.name]));
          const userMap = new Map((users || []).map(u => [u.id, u.full_name]));
          setHistory(data.map(h => ({ ...h, product_name: prodMap.get(h.product_id) || 'Unknown', user_name: userMap.get(h.user_id) || 'Sistem' })));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchHistory();
    const interval = setInterval(() => fetchHistory(true), 30000);
    return () => { clearInterval(interval); abortRef.current?.abort(); };
  }, [storeId]);

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-[300px]">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-5">
      {refreshing && (
        <div className="flex items-center gap-2 text-xs text-slate mb-3">
          <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full" />
          Memperbarui data...
        </div>
      )}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full"><thead><tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate font-sans font-semibold"><th className="p-3 sticky top-0 bg-surface">Waktu</th><th className="p-3 sticky top-0 bg-surface">Produk</th><th className="p-3 sticky top-0 bg-surface">Stok Lama</th><th className="p-3 sticky top-0 bg-surface">Stok Baru</th><th className="p-3 sticky top-0 bg-surface">Perubahan</th><th className="p-3 sticky top-0 bg-surface">Alasan</th></tr></thead>
          <tbody className="divide-y divide-hairline">
            {history.map(h => (
              <tr key={h.id} className="hover:bg-surface-muted">
                <td className="p-3 text-slate text-xs font-mono">{new Date(h.created_at).toLocaleString('id-ID')}</td>
                <td className="p-3 text-ink text-sm font-semibold">{h.product_name}</td>
                <td className="p-3 text-charcoal text-sm font-mono">{h.old_stock}</td>
                <td className="p-3 text-ink text-sm font-mono">{h.new_stock}</td>
                <td className="p-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.new_stock > h.old_stock ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                    {h.new_stock > h.old_stock ? `+${h.new_stock - h.old_stock}` : h.new_stock - h.old_stock}
                  </span>
                </td>
                <td className="p-3 text-charcoal text-sm">{h.reason}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate text-sm">Belum ada riwayat stok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

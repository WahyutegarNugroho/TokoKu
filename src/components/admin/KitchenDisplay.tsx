'use client';

import React, { useEffect, useState } from 'react';
import { db, type LocalKitchenOrder } from '@/lib/dexie';
import { ChefHat, Play, Check, Flame, Clock, RefreshCw } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<LocalKitchenOrder[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, { name: string; quantity: number }[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchKdsData = async () => {
    setIsLoading(true);
    try {
      const allOrders = await db.kitchenOrders.reverse().sortBy('created_at');
      setOrders(allOrders);

      // Load products for each order transaction items
      const txIds = allOrders.map(o => o.transaction_id);
      const items = await db.transactionItems.where('transaction_id').anyOf(txIds).toArray();
      const productIds = items.map(i => i.product_id);
      const products = await db.products.where('id').anyOf(productIds).toArray();
      const prodMap = new Map(products.map(p => [p.id, p.name]));

      const itemsByTx: Record<string, { name: string; quantity: number }[]> = {};
      items.forEach(item => {
        if (!itemsByTx[item.transaction_id]) {
          itemsByTx[item.transaction_id] = [];
        }
        itemsByTx[item.transaction_id].push({
          name: prodMap.get(item.product_id) || 'Produk Tidak Dikenal',
          quantity: item.quantity
        });
      });
      setOrderItems(itemsByTx);
    } catch (err) {
      console.error('Failed to load KDS data:', err);
      useToastStore.getState().addToast('Gagal memuat data KDS.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKdsData();
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: 'NEW' | 'PREPARING' | 'READY' | 'SERVED') => {
    try {
      await db.kitchenOrders.update(orderId, { status: nextStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
    } catch (err) {
      console.error('Failed to update kitchen order status:', err);
      useToastStore.getState().addToast('Gagal memperbarui status pesanan.', 'error');
    }
  };

  const activeOrders = orders.filter(o => o.status !== 'SERVED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4 bg-surface p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-lg text-ink">Kitchen Display System (KDS)</h2>
            <p className="text-xs text-slate mt-0.5">Pantau pesanan dapur secara real-time</p>
          </div>
        </div>
        <button
          onClick={fetchKdsData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline text-xs font-sans font-semibold text-charcoal hover:bg-canvas transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segarkan
        </button>
      </div>

      {activeOrders.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl border border-hairline">
          <ChefHat className="w-12 h-12 text-slate mx-auto mb-3 opacity-30" />
          <p className="font-sans font-semibold text-ink">Dapur Bersih!</p>
          <p className="text-xs text-muted mt-1">Tidak ada pesanan aktif saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeOrders.map((order) => {
            const items = orderItems[order.transaction_id] || [];
            const minutesElapsed = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
            const isLate = minutesElapsed > 15;

            return (
              <div
                key={order.id}
                className={`border rounded-2xl bg-surface flex flex-col justify-between overflow-hidden shadow-sm transition-all ${
                  isLate && order.status !== 'READY'
                    ? 'border-rose-300 ring-2 ring-rose-500/20'
                    : 'border-hairline hover:border-slate/50'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-charcoal">
                      #{order.transaction_id.slice(-6).toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate font-medium">
                        <Clock className="w-3 h-3" />
                        {minutesElapsed}m
                      </div>
                      {isLate && order.status !== 'READY' && (
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> Terlambat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="p-4 space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-baseline">
                        <span className="font-sans text-sm text-ink font-medium leading-tight">
                          {item.name}
                        </span>
                        <span className="font-mono text-sm font-bold text-primary ml-4">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                    {order.notes && (
                      <div className="mt-3 text-xs bg-canvas p-2.5 rounded-xl border border-hairline-soft font-sans italic text-slate">
                        Catatan: {order.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 border-t border-hairline bg-surface-muted flex gap-2">
                  {order.status === 'NEW' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                      className="w-full h-9 rounded-lg bg-amber-500 text-white font-sans font-semibold text-xs hover:bg-amber-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Mulai Masak
                    </button>
                  )}
                  {order.status === 'PREPARING' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'READY')}
                      className="w-full h-9 rounded-lg bg-emerald-500 text-white font-sans font-semibold text-xs hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Selesai Masak
                    </button>
                  )}
                  {order.status === 'READY' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'SERVED')}
                      className="w-full h-9 rounded-lg bg-primary text-on-primary font-sans font-semibold text-xs hover:bg-primary-pressed transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Sajikan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

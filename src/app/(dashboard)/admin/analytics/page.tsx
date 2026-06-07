'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/dexie';
import { useAuthStore } from '@/store/authStore';
import { type Product } from '@/types';
import { exportCSV } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const AnalyticsTab = dynamic(() => import('@/components/admin').then(m => m.AnalyticsTab), { ssr: false });

const LOW_STOCK_THRESHOLD = 5;
const MS_PER_DAY = 86_400_000;

interface RawTx {
  id: string;
  store_id: string;
  shift_id: string | null;
  total_amount: number;
  tax: number;
  discount: number;
  customer_id?: string | null;
  payment_method: string;
  status: string | null;
  created_at: string;
  sync_status: boolean;
}

interface RawItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  price: number;
  discount: number;
  subtotal: number;
}

interface SupabaseTx extends RawTx {
  transaction_items?: RawItem[];
}

type EnrichedTx = RawTx & { items: (RawItem & { productName: string })[] };

export default function AnalyticsPage() {
  const { activeStore } = useAuthStore();
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [analyticsData, setAnalyticsData] = useState<{
    revenue: number;
    volume: number;
    tax: number;
    aov: number;
    payments: { CASH: number; DEBIT: number; QRIS: number; EWALLET: number; TRANSFER: number; CREDIT: number; DEBT: number; SPLIT: number };
    dailyRevenue: { date: string; amount: number }[];
    lowStockProducts: Product[];
    recentTransactions: EnrichedTx[];
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!activeStore) return;
    setAnalyticsLoading(true);
    try {
      let txs: RawTx[] | null = null;
      let filteredItems: RawItem[] | null = null;

      const now = new Date();
      const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      let dateFilter: string | undefined;
      if (analyticsPeriod === 'today') dateFilter = new Date(utcNow).toISOString();
      else if (analyticsPeriod === 'week') dateFilter = new Date(utcNow - now.getUTCDay() * MS_PER_DAY).toISOString();
      else if (analyticsPeriod === 'month') dateFilter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      if (navigator.onLine) {
        try {
          // Fetch headers only (no items) to calculate totals
          let query = supabase
            .from('transactions')
            .select('id, store_id, shift_id, total_amount, tax, discount, customer_id, payment_method, status, created_at')
            .eq('store_id', activeStore.id);
          if (dateFilter) query = query.gte('created_at', dateFilter);
          const { data: serverTxs, error: txError } = await query;

          if (txError) throw txError;

          // Fetch recent 15 transactions WITH items
          const { data: recentTxs, error: recentError } = await supabase
            .from('transactions')
            .select('*, transaction_items(*)')
            .eq('store_id', activeStore.id)
            .order('created_at', { ascending: false })
            .limit(15);

          if (recentError) throw recentError;

          if (serverTxs) {
            txs = serverTxs.map((t) => ({
              id: t.id,
              store_id: t.store_id,
              shift_id: t.shift_id,
              total_amount: Number(t.total_amount),
              tax: Number(t.tax),
              discount: Number(t.discount ?? 0),
              customer_id: t.customer_id,
              payment_method: t.payment_method,
              status: t.status,
              created_at: t.created_at,
              sync_status: true,
            }));

            // Collect items from the recent transactions only
            const supabaseRecent = (recentTxs || []) as unknown as SupabaseTx[];
            filteredItems = supabaseRecent.flatMap((t) =>
              (t.transaction_items || []).map((ti) => ({
                id: ti.id,
                transaction_id: ti.transaction_id,
                product_id: ti.product_id,
                quantity: Number(ti.quantity),
                price: Number(ti.price),
                discount: Number(ti.discount ?? 0),
                subtotal: Number(ti.subtotal),
              }))
            );
          }
        } catch (apiErr) {
          console.warn('Failed to fetch analytics from Supabase, falling back to local DB:', apiErr);
        }
      }

      if (!txs || !filteredItems) {
        const localTxs = await db.transactions.where('store_id').equals(activeStore.id).toArray();
        txs = dateFilter ? localTxs.filter((t) => t.created_at >= dateFilter) : localTxs;
        const recentTxs = [...txs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15);
        const recentTxIds = new Set(recentTxs.map(t => t.id));
        const allItems = await db.transactionItems.toArray();
        filteredItems = allItems.filter((item) => recentTxIds.has(item.transaction_id));
      }

      const currentTxIds = new Set(txs.map((t) => t.id));
      const activeFilteredItems = filteredItems.filter((item) => currentTxIds.has(item.transaction_id));

      const prods = await db.products.where('store_id').equals(activeStore.id).toArray();
      const revenue = txs.reduce((sum, t) => sum + t.total_amount, 0);
      const volume = txs.length;
      const tax = txs.reduce((sum, t) => sum + t.tax, 0);
      const aov = volume > 0 ? revenue / volume : 0;
      const payments = { CASH: 0, DEBIT: 0, QRIS: 0, EWALLET: 0, TRANSFER: 0, CREDIT: 0, DEBT: 0, SPLIT: 0 };

      txs.forEach((t) => {
        const method = t.payment_method as keyof typeof payments;
        if (payments[method] !== undefined) {
          payments[method] += t.total_amount;
        }
      });

      const dailyMap = new Map<string, number>();
      const dayStart = new Date(now.getTime() - 6 * MS_PER_DAY);
      for (let d = new Date(dayStart); d <= now; d.setDate(d.getDate() + 1)) {
        dailyMap.set(d.toISOString().slice(0, 10), 0);
      }

      txs.forEach((t) => {
        const day = t.created_at.slice(0, 10);
        if (dailyMap.has(day)) dailyMap.set(day, dailyMap.get(day)! + t.total_amount);
      });

      const dailyRevenue = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));
      const lowStockProducts = prods.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);

      const enrichedTxs = txs.map((t) => {
        const items = activeFilteredItems.filter((item) => item.transaction_id === t.id);
        return {
          ...t,
          shift_id: t.shift_id ?? '',
          items: items.map((item) => {
            const prod = prods.find((p) => p.id === item.product_id);
            return {
              ...item,
              productName: prod ? prod.name : 'Tidak Dikenal',
            };
          }),
        };
      });

      enrichedTxs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAnalyticsData({
        revenue,
        volume,
        tax,
        aov,
        payments,
        dailyRevenue,
        lowStockProducts,
        recentTransactions: enrichedTxs,
      });
    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [activeStore, analyticsPeriod]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, [activeStore, analyticsPeriod, fetchAnalytics]);

  if (analyticsLoading && !analyticsData) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-slate bg-surface rounded-xl border border-hairline p-6">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
        Memuat data analitik...
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-hairline p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-hairline">
        <h3 className="font-sans font-bold text-[18px] text-ink">Analitik Penjualan</h3>
        <div className="flex bg-canvas rounded-lg p-0.5 border border-hairline">
          {(['today', 'week', 'month', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setAnalyticsPeriod(period)}
              className={`px-3 py-1.5 rounded-md text-xs font-sans font-bold transition-all cursor-pointer ${
                analyticsPeriod === period ? 'bg-surface text-primary shadow-sm' : 'text-slate hover:text-charcoal'
              }`}
            >
              {period === 'today' ? 'Hari Ini' : period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {analyticsData && (
        <AnalyticsTab
          period={analyticsPeriod}
          onPeriodChange={setAnalyticsPeriod}
          loading={analyticsLoading}
          data={analyticsData}
          expandedTxId={expandedTxId}
          onExpandTx={setExpandedTxId}
          onExportCSV={exportCSV}
        />
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { Loader2, TrendingUp, AlertTriangle, Layers, ChevronDown, ChevronUp, DollarSign, Activity, CheckCircle, Coins, CreditCard, QrCode } from 'lucide-react';
import { formatShortId } from '@/lib/utils';

interface Product {
  id: string; name: string; price: number; stock: number;
  sku: string; category_id?: string | null;
}

interface AnalyticsData {
  revenue: number; volume: number; tax: number; aov: number;
  payments: { CASH: number; DEBIT: number; QRIS: number; EWALLET: number; TRANSFER: number; CREDIT: number; DEBT: number; SPLIT: number };
  dailyRevenue: { date: string; amount: number }[];
  lowStockProducts: Product[];
  recentTransactions: ({ id: string; total_amount: number; tax: number; discount: number; payment_method: string; status: string | null; created_at: string; items: { productName: string; id: string; transaction_id: string; product_id: string; quantity: number; price: number; discount: number; subtotal: number }[] })[];
}

interface AnalyticsTabProps {
  period: 'today' | 'week' | 'month' | 'all';
  onPeriodChange: (p: 'today' | 'week' | 'month' | 'all') => void;
  loading: boolean;
  data: AnalyticsData | null;
  expandedTxId: string | null;
  onExpandTx: (id: string | null) => void;
  onExportCSV: (data: Record<string, unknown>[], filename: string) => void;
}

export default function AnalyticsTab({ period, onPeriodChange, loading, data, expandedTxId, onExpandTx, onExportCSV }: AnalyticsTabProps) {
  if (loading) return <div className="p-12 text-center text-slate"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />Menyusun analitik...</div>;
  if (!data) return <div className="p-12 text-center text-slate bg-surface rounded-xl border border-hairline">Gagal menyusun data.</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {([{ key: 'today', label: 'Hari Ini' }, { key: 'week', label: 'Minggu Ini' }, { key: 'month', label: 'Bulan Ini' }, { key: 'all', label: 'Semua' }] as const).map(p => (
          <button key={p.key} onClick={() => onPeriodChange(p.key)}
            className={'px-4 py-2 rounded-lg font-sans font-semibold text-[13px] transition-colors cursor-pointer ' + (period === p.key ? 'bg-primary text-on-primary' : 'bg-surface border border-hairline text-charcoal hover:bg-surface-muted')}>{p.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface p-6 rounded-xl border border-hairline flex items-center justify-between "><div><span className="text-[12px] font-sans font-bold text-slate uppercase tracking-wider">Total Omzet</span><h3 className="text-[22px] font-mono font-bold text-primary mt-1">Rp {data.revenue.toLocaleString('id-ID')}</h3></div><div className="w-12 h-12 bg-primary-soft text-primary rounded-xl flex items-center justify-center"><DollarSign className="w-6 h-6" /></div></div>
        <div className="bg-surface p-6 rounded-xl border border-hairline flex items-center justify-between "><div><span className="text-[12px] font-sans font-bold text-slate uppercase tracking-wider">Volume</span><h3 className="text-[22px] font-mono font-bold text-ink mt-1">{data.volume} Tx</h3></div><div className="w-12 h-12 bg-success-soft text-success rounded-xl flex items-center justify-center"><TrendingUp className="w-6 h-6" /></div></div>
        <div className="bg-surface p-6 rounded-xl border border-hairline flex items-center justify-between "><div><span className="text-[12px] font-sans font-bold text-slate uppercase tracking-wider">PPN (11%)</span><h3 className="text-[22px] font-mono font-bold text-charcoal mt-1">Rp {data.tax.toLocaleString('id-ID')}</h3></div><div className="w-12 h-12 bg-warning-soft text-warning rounded-xl flex items-center justify-center"><Layers className="w-6 h-6" /></div></div>
        <div className="bg-surface p-6 rounded-xl border border-hairline flex items-center justify-between "><div><span className="text-[12px] font-sans font-bold text-slate uppercase tracking-wider">Rata-rata</span><h3 className="text-[22px] font-mono font-bold text-charcoal mt-1">Rp {data.aov.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</h3></div><div className="w-12 h-12 bg-primary-soft text-primary rounded-xl flex items-center justify-center"><Activity className="w-6 h-6" /></div></div>
      </div>

      <div className="bg-surface p-6 rounded-xl border border-hairline">
        <h3 className="font-sans font-bold text-[18px] text-ink mb-4">Omzet 7 Hari Terakhir</h3>
        <div className="flex items-end gap-3 h-[160px]">
          {data.dailyRevenue.map(d => {
            const max = Math.max(...data.dailyRevenue.map(x => x.amount), 1);
            const pct = (d.amount / max) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="font-mono text-[10px] text-slate">Rp {(d.amount / 1000).toFixed(0)}k</span>
                <div className="w-full bg-primary-soft rounded-t-md relative" style={{ height: Math.max(pct, 2) + '%' }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all" style={{ height: pct + '%' }} />
                </div>
                <span className="font-mono text-[9px] text-slate">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { method: 'CASH' as const, label: 'Tunai', icon: Coins, color: 'text-success', bg: 'bg-success-soft' },
          { method: 'DEBIT' as const, label: 'Debit', icon: CreditCard, color: 'text-primary', bg: 'bg-primary-soft' },
          { method: 'QRIS' as const, label: 'QRIS', icon: QrCode, color: 'text-ai-accent', bg: 'bg-primary-soft' },
        ].map(pm => {
          const total = data.payments[pm.method] || 0;
          const pct = data.revenue > 0 ? (total / data.revenue) * 100 : 0;
          const Icon = pm.icon;
          return (
            <div key={pm.method} className="bg-surface p-5 rounded-xl border border-hairline">
              <div className="flex items-center gap-2 mb-3">
                <div className={'w-9 h-9 ' + pm.bg + ' rounded-lg flex items-center justify-center ' + pm.color}><Icon className="w-5 h-5" /></div>
                <span className="font-sans font-bold text-[15px] text-ink">{pm.label}</span>
              </div>
              <p className="font-mono font-bold text-[20px] text-ink">Rp {total.toLocaleString('id-ID')}</p>
              <div className="mt-2 h-2 bg-canvas rounded-full overflow-hidden">
                <div className={'h-full rounded-full ' + pm.color.replace('text', 'bg')} style={{ width: pct + '%' }} />
              </div>
              <p className="font-mono text-[12px] text-slate mt-1">{pct.toFixed(1)}% dari total</p>
            </div>
          );
        })}
      </div>

      {data.lowStockProducts.length > 0 && (
        <div className="bg-warning-soft border border-warning/20 rounded-xl p-6">
          <h3 className="font-sans font-bold text-warning flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5" />Stok Kritis (≤ 5)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.lowStockProducts.map(p => (
              <div key={p.id} className="bg-surface p-3 rounded-lg border border-warning/20"><p className="font-sans font-semibold text-sm text-ink truncate">{p.name}</p><p className="font-mono text-xs text-danger font-bold mt-1">Stok: {p.stock}</p></div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
        <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between">
          <h3 className="font-sans font-bold text-[18px] text-ink">Transaksi Terakhir</h3>
          <button onClick={() => onExportCSV(data.recentTransactions.map(tx => ({ Invoice: '#' + formatShortId(tx.id), Total: tx.total_amount, Pajak: tx.tax, Metode: tx.payment_method, Tanggal: new Date(tx.created_at).toLocaleString('id-ID') })), 'transaksi')} className="text-xs text-primary font-semibold hover:underline cursor-pointer">Export CSV</button>
        </div>
        {data.recentTransactions.length === 0 ? <div className="p-12 text-center text-slate font-sans">Belum ada transaksi.</div>
        : <div className="divide-y divide-hairline">{data.recentTransactions.slice(0, 15).map(tx => (
          <div key={tx.id}>
            <button onClick={() => onExpandTx(expandedTxId === tx.id ? null : tx.id)} className="w-full p-4 flex items-center justify-between hover:bg-surface-muted cursor-pointer text-left">
              <div><p className="font-mono text-[13px] text-ink font-semibold">#{formatShortId(tx.id)}</p><p className="font-sans text-xs text-slate">{new Date(tx.created_at).toLocaleString('id-ID')}</p></div>
              <div className="flex items-center gap-3"><span className="font-mono font-bold text-primary">Rp {tx.total_amount.toLocaleString('id-ID')}</span>{expandedTxId === tx.id ? <ChevronUp className="w-4 h-4 text-slate" /> : <ChevronDown className="w-4 h-4 text-slate" />}</div>
            </button>
            {expandedTxId === tx.id && (
              <div className="px-4 pb-4 bg-canvas mx-4 mb-4 rounded-lg">
                <div className="space-y-1 py-2 text-sm font-mono">{tx.items.map((item, i) => <div key={i} className="flex justify-between"><span>{item.productName} x{item.quantity}</span><span>Rp {item.subtotal.toLocaleString('id-ID')}</span></div>)}</div>
                <div className="flex items-center gap-3 pt-2 border-t border-hairline text-xs text-slate font-sans"><CheckCircle className="w-3 h-3" /><span>{tx.payment_method}</span></div>
              </div>
            )}
          </div>
        ))}</div>}
      </div>
    </div>
  );
}

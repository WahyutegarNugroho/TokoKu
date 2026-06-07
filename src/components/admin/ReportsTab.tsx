'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, FileText, Download, Search, Calendar } from 'lucide-react';

interface ReportRow {
  date: string;
  transactionId: string;
  customerName: string;
  items: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
}

export default function ReportsTab() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const fromStr = new Date(dateFrom).toISOString();
      const toStr = new Date(dateTo + 'T23:59:59').toISOString();

      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, created_at, total_amount, tax, discount, payment_method, status, customer_id, customers(name), transaction_items(product_id)')
          .eq('store_id', storeId)
          .gte('created_at', fromStr)
          .lte('created_at', toStr)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRows((data || []).map((t: Record<string, unknown>) => {
          const c = t.customers as { name?: string } | undefined;
          const items = t.transaction_items as { product_id: string }[] | undefined;
          return {
            date: new Date(t.created_at as string).toLocaleString('id-ID'),
            transactionId: (t.id as string).slice(0, 8),
            customerName: c?.name || '-',
            items: items?.length || 0,
            subtotal: Number(t.total_amount) + Number(t.tax) + Number(t.discount),
            discount: Number(t.discount),
            tax: Number(t.tax),
            total: Number(t.total_amount),
            paymentMethod: t.payment_method as string,
            status: (t.status as string) || 'COMPLETED',
          };
        }));
      } else {
        const all = await db.transactions
          .where('store_id').equals(storeId)
          .filter(t => t.created_at >= fromStr && t.created_at <= toStr)
          .toArray();
        all.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setRows(all.map(t => ({
          date: new Date(t.created_at).toLocaleString('id-ID'),
          transactionId: t.id.slice(0, 8),
          customerName: '-',
          items: 0,
          subtotal: t.total_amount + t.tax + t.discount,
          discount: t.discount,
          tax: t.tax,
          total: t.total_amount,
          paymentMethod: t.payment_method,
          status: t.status || 'COMPLETED',
        })));
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memuat laporan.', 'error');
    } finally { setLoading(false); }
  }, [storeId, dateFrom, dateTo, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const exportCSV = () => {
    if (rows.length === 0) return;
    const header = 'Tanggal,ID Transaksi,Pelanggan,Item,Subtotal,Diskon,Pajak,Total,Metode,Status\n';
    const csv = header + rows.map(r =>
      `"${r.date}","${r.transactionId}","${r.customerName}",${r.items},${r.subtotal},${r.discount},${r.tax},${r.total},"${r.paymentMethod}","${r.status}"`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `laporan_${dateFrom}_${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const totals = rows.reduce((acc, r) => ({
    count: acc.count + 1, subtotal: acc.subtotal + r.subtotal, discount: acc.discount + r.discount,
    tax: acc.tax + r.tax, total: acc.total + r.total,
  }), { count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 });

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-sans font-bold text-[18px] text-ink">Laporan Penjualan</h3>
        <button onClick={exportCSV} disabled={rows.length === 0}
          className="bg-primary text-on-primary font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-primary-pressed cursor-pointer disabled:opacity-50 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Date Filter */}
      <div className="p-4 border-b border-hairline flex flex-wrap gap-3 items-center">
        <Calendar className="w-4 h-4 text-slate" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary" />
        <span className="text-slate">—</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary" />
        <button onClick={fetchData} className="bg-primary text-on-primary font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-primary-pressed cursor-pointer flex items-center gap-2">
          <Search className="w-4 h-4" /> Tampilkan
        </button>
      </div>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border-b border-hairline">
          <div className="bg-canvas p-3 rounded-lg"><span className="text-xs text-slate block">Transaksi</span><span className="font-mono font-bold text-ink">{totals.count}</span></div>
          <div className="bg-canvas p-3 rounded-lg"><span className="text-xs text-slate block">Subtotal</span><span className="font-mono font-bold text-ink">Rp {totals.subtotal.toLocaleString('id-ID')}</span></div>
          <div className="bg-canvas p-3 rounded-lg"><span className="text-xs text-slate block">Diskon</span><span className="font-mono font-bold text-danger">-Rp {totals.discount.toLocaleString('id-ID')}</span></div>
          <div className="bg-canvas p-3 rounded-lg"><span className="text-xs text-slate block">Pajak</span><span className="font-mono font-bold text-ink">Rp {totals.tax.toLocaleString('id-ID')}</span></div>
          <div className="bg-canvas p-3 rounded-lg"><span className="text-xs text-primary block">Total</span><span className="font-mono font-bold text-primary">Rp {totals.total.toLocaleString('id-ID')}</span></div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" /><p className="text-sm text-slate">Memuat laporan...</p></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center"><FileText className="w-12 h-12 mx-auto text-slate mb-3" /><p className="text-sm text-slate">Tidak ada data untuk periode ini.</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate font-sans font-semibold">
                <th className="p-3">Tanggal</th><th className="p-3">ID</th><th className="p-3">Pelanggan</th><th className="p-3 text-right">Item</th>
                <th className="p-3 text-right">Subtotal</th><th className="p-3 text-right">Diskon</th><th className="p-3 text-right">Pajak</th>
                <th className="p-3 text-right">Total</th><th className="p-3">Metode</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-surface-muted text-sm">
                  <td className="p-3 text-charcoal whitespace-nowrap">{r.date}</td>
                  <td className="p-3 font-mono text-xs text-slate">#{r.transactionId}</td>
                  <td className="p-3 text-ink">{r.customerName}</td>
                  <td className="p-3 text-right text-charcoal">{r.items}</td>
                  <td className="p-3 text-right font-mono">Rp {r.subtotal.toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right font-mono text-danger">{r.discount > 0 ? `-Rp ${r.discount.toLocaleString('id-ID')}` : '-'}</td>
                  <td className="p-3 text-right font-mono">Rp {r.tax.toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right font-mono font-bold text-primary">Rp {r.total.toLocaleString('id-ID')}</td>
                  <td className="p-3 text-charcoal">{r.paymentMethod}</td>
                  <td className="p-3"><span className={`text-xs font-bold px-2 py-1 rounded-full ${r.status === 'COMPLETED' ? 'bg-success-soft text-success' : r.status === 'REFUNDED' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

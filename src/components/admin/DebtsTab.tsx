'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { debtsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, Search, ChevronDown, ChevronUp, Wallet } from 'lucide-react';

interface DebtWithCustomer {
  id: string;
  store_id: string;
  transaction_id: string;
  customer_id: string;
  amount: number;
  remaining_amount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  due_date?: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  notes?: string;
}

export default function DebtsTab() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [debts, setDebts] = useState<DebtWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL');
  const [search, setSearch] = useState('');
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, DebtPayment[]>>({});
  const [payLoading, setPayLoading] = useState(false);

  // Payment modal state
  const [payModalDebt, setPayModalDebt] = useState<DebtWithCustomer | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'OTHER'>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      if (navigator.onLine) {
        const { data, error } = await debtsApi.list(storeId);
        if (error) throw error;
        setDebts((data || []).map((d: Record<string, unknown>) => {
          const c = d.customers as { name?: string; phone?: string } | undefined;
          return {
            id: d.id as string,
            store_id: d.store_id as string,
            transaction_id: d.transaction_id as string,
            customer_id: d.customer_id as string,
            amount: Number(d.amount),
            remaining_amount: Number(d.remaining_amount),
            status: d.status as DebtWithCustomer['status'],
            due_date: d.due_date as string | undefined,
            created_at: d.created_at as string,
            customer_name: c?.name,
            customer_phone: c?.phone,
          };
        }));
      } else {
        const local = await db.customerDebts.where('store_id').equals(storeId).toArray();
        setDebts(local.map(d => ({
          id: d.id,
          store_id: d.store_id,
          transaction_id: d.transaction_id,
          customer_id: d.customer_id,
          amount: d.amount,
          remaining_amount: d.remaining_amount,
          status: d.status,
          due_date: d.due_date,
          created_at: d.created_at,
          customer_name: undefined,
        })));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat piutang.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchDebts();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [storeId, fetchDebts]);

  const fetchPayments = async (debtId: string) => {
    if (payments[debtId]) return;
    setPayLoading(true);
    try {
      const { data } = await debtsApi.listPayments(debtId);
      setPayments(prev => ({ ...prev, [debtId]: (data || []) as DebtPayment[] }));
    } catch {
      addToast('Gagal memuat riwayat pembayaran.', 'error');
    } finally {
      setPayLoading(false);
    }
  };

  const toggleExpand = (debtId: string) => {
    if (expandedDebt === debtId) {
      setExpandedDebt(null);
      return;
    }
    setExpandedDebt(debtId);
    fetchPayments(debtId);
  };

  const filteredDebts = debts.filter(d => {
    if (filter !== 'ALL' && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = d.customer_name?.toLowerCase() || '';
      const phone = d.customer_phone?.toLowerCase() || '';
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const totalRemaining = filteredDebts.reduce((sum, d) => sum + d.remaining_amount, 0);

  const submitPayment = async () => {
    if (!payModalDebt || !storeId) return;
    if (payAmount <= 0) {
      addToast('Jumlah pembayaran harus lebih dari 0.', 'error');
      return;
    }
    if (payAmount > payModalDebt.remaining_amount) {
      addToast('Jumlah pembayaran melebihi sisa piutang.', 'error');
      return;
    }
    setPaySubmitting(true);
    try {
      await debtsApi.createPayment(storeId, payModalDebt.id, { amount: payAmount, payment_method: payMethod, notes: payNotes || undefined });
      addToast('Pembayaran tercatat.', 'success');
      setPayModalDebt(null);
      setPayAmount(0);
      setPayMethod('CASH');
      setPayNotes('');
      fetchDebts();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mencatat pembayaran.', 'error');
    } finally {
      setPaySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-hairline p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
        <p className="text-sm text-slate">Memuat data piutang...</p>
      </div>
    );
  }

  if (error && debts.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-hairline p-12 text-center">
        <p className="text-danger text-sm">{error}</p>
        <button onClick={fetchDebts} className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold cursor-pointer hover:bg-primary-pressed">Coba Lagi</button>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-sans font-bold text-[18px] text-ink">Piutang</h3>
          <p className="text-sm text-slate font-sans">Total sisa: <span className="font-mono font-bold text-primary">Rp {totalRemaining.toLocaleString('id-ID')}</span></p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-4 border-b border-hairline flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
          <input
            type="text" placeholder="Cari pelanggan..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-canvas border border-hairline rounded-lg pl-9 pr-3 h-[40px] text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ' + (filter === f ? 'bg-primary text-on-primary' : 'bg-canvas border border-hairline text-charcoal hover:bg-surface-muted')}>
              {f === 'ALL' ? 'Semua' : f === 'UNPAID' ? 'Belum Dibayar' : f === 'PARTIALLY_PAID' ? 'Sebagian' : 'Lunas'}
            </button>
          ))}
        </div>
      </div>

      {/* Debt List */}
      {filteredDebts.length === 0 ? (
        <div className="p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto text-slate mb-3" />
          <p className="text-sm text-slate font-sans">Tidak ada piutang yang ditemukan.</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {filteredDebts.map(debt => (
            <div key={debt.id}>
              {/* Debt Row */}
              <div
                onClick={() => toggleExpand(debt.id)}
                className="p-4 flex items-center justify-between hover:bg-surface-muted cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">
                    {debt.customer_name || '(Pelanggan)'}
                    {debt.customer_phone && <span className="text-slate font-normal ml-2">• {debt.customer_phone}</span>}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-slate font-sans">
                    <span>Tagihan: <span className="font-mono">Rp {debt.amount.toLocaleString('id-ID')}</span></span>
                    <span>Sisa: <span className="font-mono font-semibold text-danger">Rp {debt.remaining_amount.toLocaleString('id-ID')}</span></span>
                    {debt.due_date && <span>Jatuh tempo: {new Date(debt.due_date).toLocaleDateString('id-ID')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    debt.status === 'PAID' ? 'bg-success-soft text-success' :
                    debt.status === 'PARTIALLY_PAID' ? 'bg-warning-soft text-warning' :
                    'bg-danger-soft text-danger'
                  }`}>
                    {debt.status === 'PAID' ? 'Lunas' : debt.status === 'PARTIALLY_PAID' ? 'Sebagian' : 'Belum Dibayar'}
                  </span>
                  {debt.status !== 'PAID' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPayModalDebt(debt); setPayAmount(debt.remaining_amount); }}
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-pressed cursor-pointer"
                    >
                      Bayar
                    </button>
                  )}
                  {expandedDebt === debt.id ? <ChevronUp className="w-4 h-4 text-slate" /> : <ChevronDown className="w-4 h-4 text-slate" />}
                </div>
              </div>

              {/* Expanded Payment History */}
              {expandedDebt === debt.id && (
                <div className="px-4 pb-4 pl-12 bg-canvas/50">
                  {payLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate" />
                  ) : payments[debt.id]?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate uppercase tracking-wider">Riwayat Pembayaran</p>
                      {payments[debt.id].map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-1">
                          <div className="flex gap-3 text-xs text-charcoal">
                            <span className="font-mono text-primary">-Rp {p.amount.toLocaleString('id-ID')}</span>
                            <span>{p.payment_method}</span>
                            {p.notes && <span className="text-slate">• {p.notes}</span>}
                          </div>
                          <span className="text-[11px] text-slate">{new Date(p.paid_at).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate">Belum ada pembayaran.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {payModalDebt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-hairline w-full max-w-md p-6 space-y-4">
            <h4 className="font-sans font-bold text-lg text-ink">Catat Pembayaran</h4>
            <p className="text-sm text-slate">
              Pelanggan: <span className="font-semibold text-ink">{payModalDebt.customer_name || '-'}</span>
              <br />
              Sisa piutang: <span className="font-mono font-semibold text-primary">Rp {payModalDebt.remaining_amount.toLocaleString('id-ID')}</span>
            </p>
            <div>
              <label className="text-xs font-semibold text-slate block mb-1">Jumlah Bayar</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))}
                className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[44px] text-sm font-mono focus:outline-none focus:border-primary"
                min={1} max={payModalDebt.remaining_amount} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate block mb-1">Metode Pembayaran</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value as typeof payMethod)}
                className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary">
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer</option>
                <option value="CARD">Kartu</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate block mb-1">Catatan (opsional)</label>
              <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary"
                placeholder="Mis: Pembayaran cicilan ke-2" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayModalDebt(null)} disabled={paySubmitting}
                className="flex-1 h-[44px] border border-hairline rounded-lg text-sm font-semibold text-charcoal hover:bg-canvas cursor-pointer disabled:opacity-50">Batal</button>
              <button onClick={submitPayment} disabled={paySubmitting || payAmount <= 0}
                className="flex-1 h-[44px] bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary-pressed cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {paySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

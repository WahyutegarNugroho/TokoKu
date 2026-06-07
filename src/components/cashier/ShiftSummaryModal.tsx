'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Printer, AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { db } from '@/lib/dexie';
import { escapeHtml } from '@/lib/utils';
import { useToastStore } from '@/store/toastStore';

interface ShiftSummaryModalProps {
  show: boolean;
  activeShiftId: string;
  cashierName: string;
  storeName: string;
  onClose: () => void;
  onConfirmCloseShift: () => Promise<void>;
}

interface ShiftStats {
  salesTotal: number;
  txCount: number;
  cashTotal: number;
  debitTotal: number;
  qrisTotal: number;
  splitTotal: number;
  beginningCash: number;
  cashIn: number;
  cashOut: number;
}

export default function ShiftSummaryModal({
  show,
  activeShiftId,
  cashierName,
  storeName,
  onClose,
  onConfirmCloseShift,
}: ShiftSummaryModalProps) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actualCashInput, setActualCashInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!show || !activeShiftId) return;

      async function loadStats() {
        setLoading(true);
        try {
          const txs = await db.transactions.where('shift_id').equals(activeShiftId).toArray();
          const txIds = txs.map(t => t.id);
          const splits = await db.paymentSplits.where('transaction_id').anyOf(txIds).toArray();
          const shift = await db.shifts.get(activeShiftId);
          const cashTxs = await db.cashTransactions.where('shift_id').equals(activeShiftId).toArray();

          let salesTotal = 0;
          let txCount = 0;
          let cashTotal = 0;
          let debitTotal = 0;
          let qrisTotal = 0;
          let splitTotal = 0;

          txs.forEach((t) => {
            if (t.status === 'REFUNDED' || t.status === 'VOIDED') return;
            salesTotal += t.total_amount;
            txCount++;

            if (t.payment_method === 'CASH') cashTotal += t.total_amount;
            else if (t.payment_method === 'DEBIT') debitTotal += t.total_amount;
            else if (t.payment_method === 'QRIS') qrisTotal += t.total_amount;
            else if (t.payment_method === 'SPLIT') splitTotal += t.total_amount;
          });

          splits.forEach((s) => {
            const relatedTx = txs.find(t => t.id === s.transaction_id);
            if (!relatedTx || relatedTx.status === 'REFUNDED' || relatedTx.status === 'VOIDED') return;

            if (s.method === 'CASH') cashTotal += s.amount;
            else if (s.method === 'DEBIT') debitTotal += s.amount;
            else if (s.method === 'QRIS') qrisTotal += s.amount;
          });

          const beginningCash = shift?.beginning_cash || 0;
          const cashIn = cashTxs.filter(c => c.type === 'IN').reduce((sum, c) => sum + c.amount, 0);
          const cashOut = cashTxs.filter(c => c.type === 'OUT').reduce((sum, c) => sum + c.amount, 0);

          setStats({
            salesTotal,
            txCount,
            cashTotal,
            debitTotal,
            qrisTotal,
            splitTotal,
            beginningCash,
            cashIn,
            cashOut,
          });
      } catch (err) {
        console.error('Error computing shift statistics:', err);
        useToastStore.getState().addToast('Gagal menghitung rekap shift.', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [show, activeShiftId]);

  if (!show) return null;

  const actualCash = parseFloat(actualCashInput) || 0;
  const expectedCash = stats ? stats.beginningCash + stats.cashTotal + stats.cashIn - stats.cashOut : 0;
  const difference = actualCash - expectedCash;

  const handlePrintReport = () => {
    if (!stats) return;
    const w = window.open('', '_blank');
    if (!w) { useToastStore.getState().addToast('Izinkan pop-up untuk mencetak laporan shift.', 'warning'); return; }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan Shift - ${escapeHtml(storeName)}</title>
<style>
  @page { margin: 0; } body { margin: 0; padding: 20px; font-family: "Courier New", monospace; font-size: 13px; color: #000; width: 80mm; }
  table { width: 100%; border-collapse: collapse; } td { padding: 4px 0; }
  .hdr { text-align: center; margin-bottom: 10px; } .hdr h2 { margin: 0; font-size: 15px; }
  .hdr p { margin: 2px 0; font-size: 11px; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .total td { font-weight: bold; }
  .right { text-align: right; }
  .footer { text-align: center; margin-top: 15px; font-size: 11px; }
</style></head><body>
<div class="hdr"><h2>LAPORAN CLOSE SHIFT</h2><h2>${escapeHtml(storeName)}</h2>
<p>Kasir: ${escapeHtml(cashierName)}</p><p>Waktu Cetak: ${new Date().toLocaleString('id-ID')}</p></div>
<div class="divider"></div>
<table>
  <tr><td>Total Penjualan</td><td class="right">Rp ${stats.salesTotal.toLocaleString('id-ID')}</td></tr>
  <tr><td>Transaksi Berhasil</td><td class="right">${stats.txCount}</td></tr>
</table>
<div class="divider"></div>
<table>
  <tr><td><b>Metode Pembayaran</b></td><td></td></tr>
  <tr><td>- Cash (Laci)</td><td class="right">Rp ${stats.cashTotal.toLocaleString('id-ID')}</td></tr>
  <tr><td>- Debit Card</td><td class="right">Rp ${stats.debitTotal.toLocaleString('id-ID')}</td></tr>
  <tr><td>- QRIS</td><td class="right">Rp ${stats.qrisTotal.toLocaleString('id-ID')}</td></tr>
  ${stats.splitTotal > 0 ? `<tr><td>- Split Transaction</td><td class="right">Rp ${stats.splitTotal.toLocaleString('id-ID')}</td></tr>` : ''}
</table>
<div class="divider"></div>
<table>
  <tr class="total"><td>Expected Cash</td><td class="right">Rp ${expectedCash.toLocaleString('id-ID')}</td></tr>
  <tr class="total"><td>Actual Cash Entered</td><td class="right">Rp ${actualCash.toLocaleString('id-ID')}</td></tr>
  <tr class="total"><td>Selisih / Gap</td><td class="right">${difference >= 0 ? '+' : ''}Rp ${difference.toLocaleString('id-ID')}</td></tr>
</table>
<div class="divider"></div>
<div class="footer">Laporan Close Shift Kerja UMKM<br>Simpan lembar ini sebagai arsip laci.</div>
</body></html>`;

    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  };

  const handleCloseShift = async () => {
    setIsClosing(true);
    try {
      await onConfirmCloseShift();
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast('Gagal menutup shift.', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-md w-full overflow-hidden shadow-floating" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-hairline flex justify-between items-center">
          <h3 className="font-sans font-bold text-[18px] text-ink">Rekap Tutup Shift</h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm font-semibold cursor-pointer">Batal</button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm font-sans">Menghitung rekap shift kasir...</p>
            </div>
          ) : stats ? (
            <>
              {/* Overall Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-canvas border border-hairline p-4 rounded-lg">
                  <span className="text-xs text-muted block font-sans">Total Penjualan</span>
                  <strong className="text-[17px] text-primary font-mono block mt-1">Rp {stats.salesTotal.toLocaleString('id-ID')}</strong>
                </div>
                <div className="bg-canvas border border-hairline p-4 rounded-lg">
                  <span className="text-xs text-muted block font-sans">Total Transaksi</span>
                  <strong className="text-[17px] text-ink font-mono block mt-1">{stats.txCount} Transaksi</strong>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-canvas border border-hairline p-4 rounded-lg space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate font-sans mb-2">Breakdown Metode</h4>
                <div className="flex justify-between text-sm text-charcoal font-sans">
                  <span>Cash (Total)</span>
                  <span className="font-mono font-semibold">Rp {stats.cashTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm text-charcoal font-sans">
                  <span>Debit Card</span>
                  <span className="font-mono font-semibold">Rp {stats.debitTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm text-charcoal font-sans">
                  <span>QRIS</span>
                  <span className="font-mono font-semibold">Rp {stats.qrisTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Cash Management Summary */}
              <div className="bg-canvas border border-hairline p-4 rounded-lg space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate font-sans mb-2">Manajemen Kas</h4>
                <div className="flex justify-between text-sm text-charcoal font-sans">
                  <span>Saldo Awal</span>
                  <span className="font-mono font-semibold">Rp {stats.beginningCash.toLocaleString('id-ID')}</span>
                </div>
                {stats.cashIn > 0 && (
                  <div className="flex justify-between text-sm text-success font-sans">
                    <span className="flex items-center gap-1"><ArrowDownCircle className="w-3.5 h-3.5" />Setoran</span>
                    <span className="font-mono font-semibold">+Rp {stats.cashIn.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {stats.cashOut > 0 && (
                  <div className="flex justify-between text-sm text-danger font-sans">
                    <span className="flex items-center gap-1"><ArrowUpCircle className="w-3.5 h-3.5" />Penarikan</span>
                    <span className="font-mono font-semibold">-Rp {stats.cashOut.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              {/* Expected vs Actual Cash Drawer Input */}
              <div className="border-t border-hairline pt-4 space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-charcoal font-sans">Expected Cash di Laci:</span>
                  <span className="font-mono font-bold text-base text-ink">Rp {expectedCash.toLocaleString('id-ID')}</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-charcoal mb-1">Actual Cash di Laci (Uang Fisik):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-charcoal text-sm font-semibold font-mono">Rp</span>
                    <input
                      type="number"
                      value={actualCashInput}
                      onChange={e => setActualCashInput(e.target.value)}
                      placeholder="Masukkan total uang cash di laci..."
                      className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-[48px] text-[15px] font-semibold font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Discrepancy Indicator */}
                {actualCashInput && (
                  <div className={`p-3 rounded-lg flex items-center gap-3 border text-sm font-sans ${
                    difference === 0
                      ? 'bg-success-soft text-success border-success/20'
                      : 'bg-warning-soft text-warning border-warning/20'
                  }`}>
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      {difference === 0 ? (
                        <p className="font-semibold">Jumlah laci seimbang (No discrepancy).</p>
                      ) : (
                        <p className="font-semibold">
                          Terdapat selisih:{' '}
                          <span className="font-mono">
                            {difference >= 0 ? '+' : ''}Rp {difference.toLocaleString('id-ID')}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 border-t border-hairline pt-4">
                <button
                  onClick={handlePrintReport}
                  className="px-4 bg-surface border border-hairline rounded-lg text-charcoal font-semibold text-sm hover:bg-canvas cursor-pointer flex items-center gap-2 h-[48px]"
                >
                  <Printer className="w-4 h-4" /> Cetak
                </button>
                <button
                  onClick={handleCloseShift}
                  disabled={isClosing}
                  className="flex-1 bg-danger text-on-primary font-bold text-sm rounded-lg hover:opacity-95 cursor-pointer flex items-center justify-center h-[48px]"
                >
                  {isClosing ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Tutup Shift Kerja'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-slate font-sans py-4">Gagal memuat rekap shift.</p>
          )}
        </div>
      </div>
    </div>
  );
}

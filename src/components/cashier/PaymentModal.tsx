'use client';

import React, { useState } from 'react';
import { Coins, CreditCard, QrCode, RefreshCw, Wallet, Landmark, FileText, Star } from 'lucide-react';
import RupiahInput from '@/components/RupiahInput';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface PaymentSplit {
  method: 'CASH' | 'DEBIT' | 'QRIS' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT';
  amount: number;
}

interface PaymentModalProps {
  total: number;
  paymentSplits: PaymentSplit[];
  changeAmount: number | null;
  checkoutError: string | null;
  isSubmitting: boolean;
  customerPoints: { points: number; tier: string } | null;
  customerCredit?: { credit_limit: number; current_debt: number } | null;
  onClose: () => void;
  onSplitChange: (method: 'CASH' | 'DEBIT' | 'QRIS' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT', value: number) => void;
  onSubmit: () => void;
}

const POINTS_RATE = 100; // 100 points = Rp 1,000
const POINTS_DISCOUNT = 1000; // discount per POINTS_RATE

const tierLabel: Record<string, string> = {
  BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold',
};

const tierBadge: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-slate-200 text-slate-700',
  GOLD: 'bg-yellow-300 text-yellow-900',
};

export default function PaymentModal({
  total,
  paymentSplits,
  changeAmount,
  checkoutError,
  isSubmitting,
  customerPoints,
  customerCredit,
  onClose,
  onSplitChange,
  onSubmit,
}: PaymentModalProps) {
  const focusRef = useFocusTrap(true);

  const [selectedWallet, setSelectedWallet] = useState('GoPay');
  const [selectedBank, setSelectedBank] = useState('BCA');
  const [redeemPoints, setRedeemPoints] = useState(0);

  const pointsDiscount = customerPoints ? Math.floor(redeemPoints / POINTS_RATE) * POINTS_DISCOUNT : 0;
  const effectiveTotal = Math.max(0, total - pointsDiscount);
  const displayTotal = pointsDiscount > 0 ? effectiveTotal : total;

  return (
    <div ref={focusRef} className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl w-full max-w-lg border border-hairline overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between">
          <h3 className="font-sans font-bold text-[16px] text-ink">Pembayaran</h3>
          <button
            onClick={onClose}
            className="text-xs text-slate font-semibold hover:text-ink cursor-pointer"
          >
            Tutup
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {checkoutError && (
            <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm border border-danger/20">
              {checkoutError}
            </div>
          )}

          <div className="bg-canvas rounded-xl p-4 text-center">
            <span className="font-sans text-xs text-slate font-medium block">Total Tagihan</span>
            <h4 className="font-sans font-bold text-[28px] text-primary tracking-tight mt-1">
              Rp {total.toLocaleString('id-ID')}
            </h4>
          </div>

          {/* Points Redemption */}
          {customerPoints && (
            <div className="p-3 border border-hairline rounded-xl bg-surface">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Poin Anda: {customerPoints.points} pts
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierBadge[customerPoints.tier] || ''}`}>
                    {tierLabel[customerPoints.tier] || customerPoints.tier}
                  </span>
                </div>
              </div>
              {customerPoints.points >= POINTS_RATE && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={customerPoints.points} step={POINTS_RATE}
                    value={redeemPoints || ''}
                    onChange={e => setRedeemPoints(Math.min(Number(e.target.value), customerPoints.points))}
                    placeholder="Tukar poin..."
                    className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[40px] text-sm focus:outline-none focus:border-primary"
                  />
                  {pointsDiscount > 0 && (
                    <span className="text-xs text-success font-semibold font-mono whitespace-nowrap">-Rp {pointsDiscount.toLocaleString('id-ID')}</span>
                  )}
                </div>
              )}
              {pointsDiscount > 0 && (
                <p className="text-xs text-success mt-1 font-sans">Total setelah poin: <span className="font-mono font-semibold">Rp {effectiveTotal.toLocaleString('id-ID')}</span></p>
              )}
            </div>
          )}

          {(['CASH', 'DEBIT', 'QRIS', 'EWALLET', 'TRANSFER', 'CREDIT', 'DEBT'] as const).map((method) => {
            const split = paymentSplits.find((s) => s.method === method);
            const amount = split?.amount || 0;

            const icons: Record<string, React.ReactNode> = {
              CASH: <Coins className="w-4 h-4 text-amber-500" />,
              DEBIT: <CreditCard className="w-4 h-4 text-blue-500" />,
              QRIS: <QrCode className="w-4 h-4 text-purple-500" />,
              EWALLET: <Wallet className="w-4 h-4 text-emerald-500" />,
              TRANSFER: <Landmark className="w-4 h-4 text-indigo-500" />,
              CREDIT: <CreditCard className="w-4 h-4 text-rose-500" />,
              DEBT: <FileText className="w-4 h-4 text-orange-500" />,
            };

            const labels: Record<string, string> = {
              CASH: 'Tunai',
              DEBIT: 'Debit',
              QRIS: 'QRIS',
              EWALLET: 'E-Wallet',
              TRANSFER: 'Transfer',
              CREDIT: 'K. Kredit',
              DEBT: 'Piutang',
            };

          return (
              <div key={method} className="flex flex-col gap-2 p-3 border border-hairline rounded-xl bg-surface">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 font-sans font-semibold text-sm text-charcoal">
                    {icons[method]}
                    {labels[method]}
                  </div>

                  <RupiahInput
                    value={amount}
                    placeholder="0"
                    onChange={(v) => onSplitChange(method, parseFloat(v) || 0)}
                    className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[48px] text-sm font-mono focus:outline-none focus:border-primary text-right"
                  />
                </div>

                {method === 'EWALLET' && amount > 0 && (
                  <div className="flex items-center justify-between text-xs mt-1 border-t border-hairline-soft pt-2">
                    <span className="text-slate font-sans">Pilih E-Wallet:</span>
                    <select
                      value={selectedWallet}
                      onChange={(e) => setSelectedWallet(e.target.value)}
                      className="bg-canvas border border-hairline rounded px-2 py-1 text-charcoal font-sans"
                    >
                      {['GoPay', 'OVO', 'Dana', 'ShopeePay'].map((wallet) => (
                        <option key={wallet} value={wallet}>
                          {wallet}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {method === 'TRANSFER' && amount > 0 && (
                  <div className="flex items-center justify-between text-xs mt-1 border-t border-hairline-soft pt-2">
                    <span className="text-slate font-sans">Pilih Bank:</span>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="bg-canvas border border-hairline rounded px-2 py-1 text-charcoal font-sans"
                    >
                      {['BCA', 'Mandiri', 'BRI', 'BNI'].map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {method === 'DEBT' && amount > 0 && (
                  <div className="space-y-2 text-[11px] font-sans">
                    <div className="text-orange-600 bg-orange-50 border border-orange-200 rounded p-2">
                      ⚠️ Transaksi piutang mewajibkan kasir memilih pelanggan di panel keranjang sebelum checkout.
                    </div>
                    {customerCredit && customerCredit.credit_limit > 0 && (
                      <div className="bg-canvas border border-hairline rounded p-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate">Limit Kredit:</span>
                          <span className="font-mono font-semibold text-charcoal">Rp {customerCredit.credit_limit.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate">Utang Sekarang:</span>
                          <span className="font-mono font-semibold text-charcoal">Rp {customerCredit.current_debt.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate">Sisa Limit:</span>
                          <span className={`font-mono font-semibold ${(customerCredit.credit_limit - customerCredit.current_debt - amount) < 0 ? 'text-danger' : 'text-success'}`}>
                            Rp {(customerCredit.credit_limit - customerCredit.current_debt - amount).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {method === 'CASH' && (
                  <div className="flex gap-1.5 flex-wrap justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => onSplitChange('CASH', displayTotal)}
                      className="bg-canvas border border-hairline text-[11px] font-semibold px-2 py-1.5 rounded-lg text-charcoal hover:bg-surface-muted cursor-pointer"
                    >
                      Uang Pas
                    </button>
                    {[20000, 50000, 100000, 200000].map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => onSplitChange('CASH', nom)}
                        className="bg-canvas border border-hairline text-[11px] font-semibold px-2 py-1.5 rounded-lg text-charcoal hover:bg-surface-muted cursor-pointer"
                      >
                        Rp {nom.toLocaleString('id-ID')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onSplitChange('CASH', Math.ceil(displayTotal / 10000) * 10000)}
                      className="bg-canvas border border-hairline text-[11px] font-semibold px-2 py-1.5 rounded-lg text-charcoal hover:bg-surface-muted cursor-pointer"
                    >
                      Mulai 10rb
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 border-t border-hairline-soft">
            {changeAmount !== null && changeAmount > 0 ? (
              <div className="flex justify-between items-center text-sm font-semibold text-success">
                <span>Kembali</span>
                <span className="font-mono">Rp {changeAmount.toLocaleString('id-ID')}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate">Sisa Tagihan</span>
                <span className="font-mono text-ink">
                  Rp{' '}
                  {Math.max(
                    0,
                    displayTotal - paymentSplits.reduce((s, p) => s + (p.amount || 0), 0)
                  ).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-muted border-t border-hairline flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-[15px] hover:bg-canvas transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1 h-[48px] rounded-lg bg-primary text-on-primary font-semibold text-[15px] hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer shadow"
          >
            {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}
